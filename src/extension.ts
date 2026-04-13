import { promises as fs } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { extractGlossaryEntries, mergeGlossaryWithUserOverrides } from "./analysis/glossary";
import {
  createWorkspaceFileSummary,
  createWorkspaceIndexMarkdown,
  inferGranularity,
  isSupportedWorkspaceFile
} from "./analysis/summary";
import { CONFIG_NAMESPACE, getSettings } from "./config";
import {
  ChatTurn,
  ExplanationRequest,
  ExplanationResponse,
  GlossaryCacheFile,
  GlossaryEntry,
  WorkspaceIndex
} from "./contracts";
import { syncOfficialDocsForLanguage } from "./knowledge/officialDocs";
import { KnowledgeStore } from "./knowledge/knowledgeStore";
import { ExtensionLogger } from "./logging/logger";
import { createProvider } from "./providers/createProvider";
import { ExplanationProvider } from "./providers/providerTypes";
import { WorkspaceStore } from "./storage/workspaceStore";
import { ExplanationPanel } from "./ui/explanationPanel";
import { GlossaryTreeProvider } from "./ui/glossaryTreeProvider";
import { createContentHash } from "./utils/hash";

interface SessionState {
  request?: ExplanationRequest;
  explanation?: ExplanationResponse;
  chatHistory: ChatTurn[];
  workspaceIndex?: WorkspaceIndex;
  glossaryEntries: GlossaryEntry[];
}

interface ExplainSelectionOptions {
  showProgress: boolean;
  showWarnings: boolean;
  revealPanel: boolean;
}

const ACTIVE_GLOSSARY_VIEW = "readCodeInChinese.glossaryView";

export function activate(context: vscode.ExtensionContext): void {
  const logger = new ExtensionLogger();
  const glossaryTreeProvider = new GlossaryTreeProvider();
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  const sessionState: SessionState = {
    chatHistory: [],
    glossaryEntries: []
  };
  let autoExplainTimeout: NodeJS.Timeout | undefined;
  let lastAutoExplainSignature = "";

  const panel = new ExplanationPanel(async (message) => {
    if (message.type === "ready") {
      syncPanelContext(vscode.window.activeTextEditor);
      return;
    }

    if (message.type === "askQuestion") {
      await answerFollowUp(message.question);
    }
  });

  context.subscriptions.push(
    logger,
    panel,
    statusBarItem,
    vscode.window.registerTreeDataProvider(ACTIVE_GLOSSARY_VIEW, glossaryTreeProvider)
  );

  logger.info("Extension activated");

  const registeredCommands = [
    vscode.commands.registerCommand(
      "readCodeInChinese.explainSelection",
      async () => {
        await explainSelection("manual", {
          showProgress: true,
          showWarnings: true,
          revealPanel: true
        });
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.toggleAutoExplain",
      async () => {
        await toggleAutoExplain(statusBarItem);
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.openConversationPanel",
      async () => {
        panel.show();
        syncPanelContext(vscode.window.activeTextEditor);

        if (hasNonEmptySelection(vscode.window.activeTextEditor)) {
          await explainSelection("auto", {
            showProgress: false,
            showWarnings: false,
            revealPanel: false
          });
        }
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.explainCurrentFile",
      async () => {
        await explainCurrentFile();
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.generateWorkspaceIndex",
      async () => {
        await generateWorkspaceIndex();
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.refreshGlossary",
      async () => {
        await refreshGlossaryForActiveEditor(true);
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.editGlossaryEntry",
      async (entry?: GlossaryEntry) => {
        await editGlossaryEntry(entry);
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.importKnowledgeDocuments",
      async () => {
        await importKnowledgeDocuments();
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.syncOfficialDocsForActiveLanguage",
      async () => {
        await syncOfficialDocsForActiveEditorLanguage();
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.showLogs",
      () => {
        logger.show(false);
      }
    )
  ];

  for (const command of registeredCommands) {
    context.subscriptions.push(command);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_NAMESPACE)) {
        logger.info("Configuration changed");
        updateStatusBar(statusBarItem);
        syncPanelContext(vscode.window.activeTextEditor);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      logger.info("Active editor changed", {
        filePath: editor?.document.uri.fsPath,
        languageId: editor?.document.languageId
      });
      syncPanelContext(editor);
      await refreshGlossaryForActiveEditor(false);
    }),
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
        logger.info("Active document saved", {
          filePath: document.uri.fsPath
        });
        await refreshGlossaryForActiveEditor(false);
      }
    }),
    vscode.window.onDidChangeTextEditorSelection(async (event) => {
      syncPanelContext(event.textEditor);

      if (!event.textEditor.selection || event.textEditor.selection.isEmpty) {
        return;
      }

      const shouldWatchSelection =
        getSettings().autoExplainEnabled || panel.isWatchingSelection();

      if (!shouldWatchSelection) {
        return;
      }

      const currentSelectionText = event.textEditor.document
        .getText(event.textEditor.selection)
        .trim();

      if (!currentSelectionText) {
        return;
      }

      const signature = [
        event.textEditor.document.uri.toString(),
        event.textEditor.selection.start.line,
        event.textEditor.selection.start.character,
        event.textEditor.selection.end.line,
        event.textEditor.selection.end.character,
        createContentHash(currentSelectionText)
      ].join(":");

      if (signature === lastAutoExplainSignature) {
        return;
      }

      lastAutoExplainSignature = signature;
      clearTimeout(autoExplainTimeout);
      autoExplainTimeout = setTimeout(() => {
        void explainSelection("auto", {
          showProgress: false,
          showWarnings: false,
          revealPanel: false
        });
      }, getSettings().autoExplainDelayMs);
    })
  );

  updateStatusBar(statusBarItem);
  syncPanelContext(vscode.window.activeTextEditor);
  void refreshGlossaryForActiveEditor(false);

  async function explainSelection(
    reason: "manual" | "auto",
    options: ExplainSelectionOptions
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      await handleSelectionFailure(
        "Read Code In Chinese: open a file before requesting an explanation.",
        options
      );
      return;
    }

    if (editor.selection.isEmpty) {
      await handleSelectionFailure(
        "Read Code In Chinese: select some code before requesting an explanation.",
        options
      );
      return;
    }

    const selectedText = editor.document.getText(editor.selection).trim();

    if (!selectedText) {
      await handleSelectionFailure(
        "Read Code In Chinese: the current selection is empty.",
        options
      );
      return;
    }

    const execute = async (): Promise<void> => {
      const projectContext = getProjectContext(editor.document, logger);

      if (!projectContext) {
        await handleSelectionFailure(
          "Read Code In Chinese: open a workspace folder to enable caching and knowledge features.",
          options
        );
        return;
      }

      const { relativeFilePath, workspaceStore, knowledgeStore } = projectContext;
      await workspaceStore.ensureProjectDataDirectories();

      panel.setState({
        isWatchingSelection: panel.isWatchingSelection(),
        currentFile: relativeFilePath,
        currentSelectionLabel: formatSelectionLabel(editor.selection),
        statusMessage:
          reason === "auto"
            ? "Watching selection and updating explanation..."
            : "Generating explanation..."
      });

      const glossaryEntries = await getOrCreateGlossary(
        workspaceStore,
        editor.document,
        relativeFilePath,
        false,
        logger
      );
      sessionState.glossaryEntries = glossaryEntries;
      glossaryTreeProvider.setEntries(glossaryEntries);

      const request = await createExplanationRequest(
        editor,
        selectedText,
        inferGranularity(
          selectedText,
          editor.selection.end.line - editor.selection.start.line + 1
        ),
        reason,
        glossaryEntries,
        knowledgeStore,
        relativeFilePath
      );
      const provider = createProvider(getSettings(), logger);
      const response = await runExplanationWithFallback(provider, request, logger);

      sessionState.request = request;
      sessionState.explanation = response;
      sessionState.chatHistory = [];
      panel.setState({
        explanation: response,
        chatHistory: sessionState.chatHistory,
        glossaryEntries,
        workspaceIndex: sessionState.workspaceIndex,
        isWatchingSelection: panel.isWatchingSelection(),
        currentFile: relativeFilePath,
        currentSelectionLabel: formatSelectionLabel(editor.selection),
        lastUpdatedAt: new Date().toLocaleString(),
        statusMessage: `Source: ${response.source} | Latency: ${response.latencyMs} ms`
      });

      logger.info("Explanation completed", {
        reason,
        requestId: request.requestId,
        source: response.source,
        latencyMs: response.latencyMs,
        knowledgeUsed: response.knowledgeUsed
      });

      if (options.revealPanel || getSettings().autoOpenPanel || panel.isWatchingSelection()) {
        panel.show();
        syncPanelContext(editor);
      }
    };

    logger.info("Explanation requested", {
      reason,
      filePath: editor.document.uri.fsPath,
      selection: formatSelectionLabel(editor.selection)
    });

    if (options.showProgress) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Read Code In Chinese: generating explanation",
          cancellable: false
        },
        execute
      );
      return;
    }

    await execute();
  }

  async function explainCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: open a file before requesting a file overview."
      );
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Read Code In Chinese: generating file overview",
        cancellable: false
      },
      async () => {
        const projectContext = getProjectContext(editor.document, logger);

        if (!projectContext) {
          await vscode.window.showWarningMessage(
            "Read Code In Chinese: open a workspace folder to explain the current file."
          );
          return;
        }

        const { relativeFilePath, workspaceStore, knowledgeStore } = projectContext;
        await workspaceStore.ensureProjectDataDirectories();
        const glossaryEntries = await getOrCreateGlossary(
          workspaceStore,
          editor.document,
          relativeFilePath,
          false,
          logger
        );
        sessionState.glossaryEntries = glossaryEntries;
        glossaryTreeProvider.setEntries(glossaryEntries);

        const request = await createExplanationRequest(
          editor,
          editor.document.getText(),
          "file",
          "fileOverview",
          glossaryEntries,
          knowledgeStore,
          relativeFilePath
        );
        const provider = createProvider(getSettings(), logger);
        const response = await runExplanationWithFallback(provider, request, logger);

        sessionState.request = request;
        sessionState.explanation = response;
        sessionState.chatHistory = [];
        panel.setState({
          explanation: response,
          chatHistory: [],
          glossaryEntries,
          isWatchingSelection: panel.isWatchingSelection(),
          currentFile: relativeFilePath,
          currentSelectionLabel: "Entire file",
          lastUpdatedAt: new Date().toLocaleString(),
          statusMessage: `Source: ${response.source} | Latency: ${response.latencyMs} ms`
        });
        panel.show();
        syncPanelContext(editor);

        logger.info("File overview completed", {
          filePath: editor.document.uri.fsPath,
          latencyMs: response.latencyMs,
          source: response.source
        });
      }
    );
  }

  async function generateWorkspaceIndex(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: open a workspace folder to generate a workspace index."
      );
      return;
    }

    const projectContext = getProjectContext(editor.document, logger);

    if (!projectContext) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: workspace index requires an opened workspace folder."
      );
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Read Code In Chinese: generating workspace index",
        cancellable: false
      },
      async () => {
        const index = await buildWorkspaceIndex(projectContext.workspaceRoot);

        sessionState.workspaceIndex = index;
        panel.setState({
          workspaceIndex: index,
          isWatchingSelection: panel.isWatchingSelection(),
          currentFile: projectContext.relativeFilePath,
          lastUpdatedAt: new Date().toLocaleString(),
          statusMessage: `Indexed ${index.files.length} files.`
        });
        panel.show();

        await projectContext.workspaceStore.ensureProjectDataDirectories();
        await projectContext.workspaceStore.writeWorkspaceIndex(index);
        await projectContext.workspaceStore.writeWorkspaceIndexReport(
          createWorkspaceIndexMarkdown(index)
        );

        const reportDocument = await vscode.workspace.openTextDocument(
          projectContext.workspaceStore.getWorkspaceIndexReportPath()
        );
        await vscode.window.showTextDocument(reportDocument, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside
        });

        logger.info("Workspace index generated", {
          fileCount: index.files.length
        });
      }
    );
  }

  async function refreshGlossaryForActiveEditor(forceRefresh: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      glossaryTreeProvider.setEntries([]);
      panel.setState({
        glossaryEntries: [],
        currentFile: undefined,
        currentSelectionLabel: undefined,
        isWatchingSelection: panel.isWatchingSelection()
      });
      return;
    }

    const projectContext = getProjectContext(editor.document, logger);

    if (!projectContext) {
      glossaryTreeProvider.setEntries([]);
      panel.setState({
        glossaryEntries: [],
        currentFile: path.basename(editor.document.uri.fsPath),
        currentSelectionLabel: formatSelectionLabel(editor.selection),
        isWatchingSelection: panel.isWatchingSelection()
      });
      return;
    }

    const glossaryEntries = await getOrCreateGlossary(
      projectContext.workspaceStore,
      editor.document,
      projectContext.relativeFilePath,
      forceRefresh,
      logger
    );

    sessionState.glossaryEntries = glossaryEntries;
    glossaryTreeProvider.setEntries(glossaryEntries);
    panel.setState({
      glossaryEntries,
      currentFile: projectContext.relativeFilePath,
      currentSelectionLabel: formatSelectionLabel(editor.selection),
      isWatchingSelection: panel.isWatchingSelection()
    });
  }

  async function editGlossaryEntry(entry?: GlossaryEntry): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !entry) {
      return;
    }

    const projectContext = getProjectContext(editor.document, logger);

    if (!projectContext) {
      return;
    }

    const updatedMeaning = await vscode.window.showInputBox({
      prompt: `Edit glossary meaning for ${entry.term}`,
      value: entry.meaning,
      ignoreFocusOut: true
    });

    if (!updatedMeaning) {
      return;
    }

    const glossaryEntries = await getOrCreateGlossary(
      projectContext.workspaceStore,
      editor.document,
      projectContext.relativeFilePath,
      false,
      logger
    );
    const updatedEntries = glossaryEntries.map((glossaryEntry) =>
      glossaryEntry.normalizedTerm === entry.normalizedTerm
        ? {
            ...glossaryEntry,
            meaning: updatedMeaning,
            source: "user" as const,
            updatedAt: new Date().toISOString()
          }
        : glossaryEntry
    );
    const sourceHash = createContentHash(editor.document.getText());
    const glossaryCache: GlossaryCacheFile = {
      languageId: editor.document.languageId,
      relativeFilePath: projectContext.relativeFilePath,
      sourceHash,
      generatedAt: new Date().toISOString(),
      entries: updatedEntries
    };

    await projectContext.workspaceStore.writeGlossaryCache(
      projectContext.relativeFilePath,
      glossaryCache
    );
    sessionState.glossaryEntries = updatedEntries;
    glossaryTreeProvider.setEntries(updatedEntries);
    panel.setState({
      glossaryEntries: updatedEntries,
      lastUpdatedAt: new Date().toLocaleString()
    });

    logger.info("Glossary entry updated", {
      term: entry.term,
      relativeFilePath: projectContext.relativeFilePath
    });

    const action = await vscode.window.showInformationMessage(
      `Updated glossary entry for ${entry.term}.`,
      "Re-run Explanation"
    );

    if (action === "Re-run Explanation" && sessionState.request) {
      await explainSelection("manual", {
        showProgress: true,
        showWarnings: true,
        revealPanel: true
      });
    }
  }

  async function importKnowledgeDocuments(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: open a workspace folder before importing knowledge documents."
      );
      return;
    }

    const projectContext = getProjectContext(editor.document, logger);

    if (!projectContext) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: knowledge import requires an opened workspace folder."
      );
      return;
    }

    const pickedFiles = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: "Import Knowledge Documents",
      filters: {
        Documents: ["md", "txt", "json"]
      }
    });

    if (!pickedFiles || pickedFiles.length === 0) {
      return;
    }

    await projectContext.workspaceStore.ensureProjectDataDirectories();
    const importedDocuments = await projectContext.knowledgeStore.importDocuments(
      pickedFiles.map((uri) => uri.fsPath)
    );

    panel.setState({
      statusMessage: `Imported ${importedDocuments.length} knowledge documents.`,
      lastUpdatedAt: new Date().toLocaleString()
    });

    logger.info("Knowledge documents imported", {
      count: importedDocuments.length,
      files: pickedFiles.map((item) => item.fsPath)
    });

    await vscode.window.showInformationMessage(
      `Read Code In Chinese: imported ${importedDocuments.length} knowledge documents.`
    );
  }

  async function syncOfficialDocsForActiveEditorLanguage(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: open a file before syncing official docs."
      );
      return;
    }

    const projectContext = getProjectContext(editor.document, logger);

    if (!projectContext) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: official docs sync requires an opened workspace folder."
      );
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Read Code In Chinese: syncing ${editor.document.languageId} docs`,
        cancellable: false
      },
      async () => {
        await projectContext.workspaceStore.ensureProjectDataDirectories();
        const syncResult = await syncOfficialDocsForLanguage(editor.document.languageId, logger);
        await projectContext.knowledgeStore.upsertDocuments(syncResult.importedDocuments);
        const failureSuffix = syncResult.failedSources.length
          ? ` Failed: ${syncResult.failedSources.length}.`
          : "";

        panel.setState({
          statusMessage: `Synced ${syncResult.importedDocuments.length} official docs for ${syncResult.label}.${failureSuffix}`,
          lastUpdatedAt: new Date().toLocaleString()
        });

        logger.info("Official docs synced", {
          languageId: editor.document.languageId,
          importedDocuments: syncResult.importedDocuments.length,
          failedSources: syncResult.failedSources.length
        });

        await vscode.window.showInformationMessage(
          `Read Code In Chinese: synced ${syncResult.importedDocuments.length} official docs for ${syncResult.label}.${failureSuffix}`
        );
      }
    );
  }

  async function answerFollowUp(question: string): Promise<void> {
    if (!sessionState.request || !sessionState.explanation) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: generate an explanation before asking follow-up questions."
      );
      return;
    }

    const provider = createProvider(getSettings(), logger);
    sessionState.chatHistory.push({
      role: "user",
      content: question,
      createdAt: new Date().toISOString()
    });
    panel.setState({
      chatHistory: sessionState.chatHistory,
      statusMessage: "Generating follow-up answer..."
    });

    const followUpResponse = await runFollowUpWithFallback(
      provider,
      {
        request: sessionState.request,
        explanation: sessionState.explanation,
        question,
        chatHistory: sessionState.chatHistory
      },
      logger
    );

    sessionState.chatHistory.push({
      role: "assistant",
      content: followUpResponse.answer,
      createdAt: new Date().toISOString()
    });
    panel.setState({
      chatHistory: sessionState.chatHistory,
      lastUpdatedAt: new Date().toLocaleString(),
      statusMessage: `Source: ${followUpResponse.source} | Latency: ${followUpResponse.latencyMs} ms`
    });
  }

  async function handleSelectionFailure(
    message: string,
    options: ExplainSelectionOptions
  ): Promise<void> {
    logger.warn("Selection explanation skipped", message);

    panel.setState({
      isWatchingSelection: panel.isWatchingSelection(),
      statusMessage: message,
      currentFile: vscode.window.activeTextEditor
        ? getProjectContext(vscode.window.activeTextEditor.document, logger)?.relativeFilePath ??
          path.basename(vscode.window.activeTextEditor.document.uri.fsPath)
        : undefined,
      currentSelectionLabel: vscode.window.activeTextEditor
        ? formatSelectionLabel(vscode.window.activeTextEditor.selection)
        : undefined
    });

    if (options.showWarnings) {
      await vscode.window.showWarningMessage(message);
    }
  }

  function syncPanelContext(editor: vscode.TextEditor | undefined): void {
    const projectContext = editor ? getProjectContext(editor.document, logger) : undefined;

    panel.setState({
      isWatchingSelection: panel.isWatchingSelection(),
      currentFile: projectContext?.relativeFilePath ?? editor?.document.fileName,
      currentSelectionLabel: editor ? formatSelectionLabel(editor.selection) : undefined
    });
  }
}

export function deactivate(): void {}

async function runExplanationWithFallback(
  provider: ExplanationProvider,
  request: ExplanationRequest,
  logger: ExtensionLogger
): Promise<ExplanationResponse> {
  try {
    return await provider.explain(request);
  } catch (error) {
    logger.error("Primary explanation provider failed, using local fallback", error);
    const fallbackProvider = createProvider(
      {
        ...getSettings(),
        providerId: "local",
        providerBaseUrl: "",
        providerModel: ""
      },
      logger
    );
    const response = await fallbackProvider.explain(request);

    return {
      ...response,
      note: `Fell back to the local engine because the configured provider failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

async function runFollowUpWithFallback(
  provider: ExplanationProvider,
  request: Parameters<ExplanationProvider["answerFollowUp"]>[0],
  logger: ExtensionLogger
) {
  try {
    return await provider.answerFollowUp(request);
  } catch (error) {
    logger.error("Primary follow-up provider failed, using local fallback", error);
    const fallbackProvider = createProvider(
      {
        ...getSettings(),
        providerId: "local",
        providerBaseUrl: "",
        providerModel: ""
      },
      logger
    );

    return fallbackProvider.answerFollowUp(request);
  }
}

async function getOrCreateGlossary(
  workspaceStore: WorkspaceStore,
  document: vscode.TextDocument,
  relativeFilePath: string,
  forceRefresh = false,
  logger?: ExtensionLogger
): Promise<GlossaryEntry[]> {
  const currentSourceHash = createContentHash(document.getText());
  const existingCache = await workspaceStore.readGlossaryCache(relativeFilePath);

  if (!forceRefresh && existingCache && existingCache.sourceHash === currentSourceHash) {
    logger?.info("Glossary cache hit", {
      relativeFilePath,
      entryCount: existingCache.entries.length
    });
    return existingCache.entries;
  }

  logger?.info("Glossary cache miss", {
    relativeFilePath,
    forceRefresh
  });

  const generatedEntries = extractGlossaryEntries(document.getText(), document.languageId);
  const mergedEntries = mergeGlossaryWithUserOverrides(
    generatedEntries,
    existingCache?.entries ?? []
  );
  const glossaryCache: GlossaryCacheFile = {
    languageId: document.languageId,
    relativeFilePath,
    sourceHash: currentSourceHash,
    generatedAt: new Date().toISOString(),
    entries: mergedEntries
  };

  await workspaceStore.writeGlossaryCache(relativeFilePath, glossaryCache);
  return mergedEntries;
}

async function createExplanationRequest(
  editor: vscode.TextEditor,
  selectedText: string,
  granularity: ExplanationRequest["granularity"],
  reason: ExplanationRequest["reason"],
  glossaryEntries: GlossaryEntry[],
  knowledgeStore: KnowledgeStore,
  relativeFilePath: string
): Promise<ExplanationRequest> {
  const settings = getSettings();
  const selection =
    reason === "fileOverview"
      ? new vscode.Selection(
          0,
          0,
          editor.document.lineCount - 1,
          editor.document.lineAt(editor.document.lineCount - 1).text.length
        )
      : editor.selection;
  const contextPadding =
    settings.detailLevel === "deep"
      ? 8
      : settings.detailLevel === "fast"
        ? 2
        : 4;
  const contextBeforeStart = Math.max(0, selection.start.line - contextPadding);
  const contextAfterEnd = Math.min(editor.document.lineCount - 1, selection.end.line + contextPadding);
  const contextBefore = editor.document
    .getText(new vscode.Range(contextBeforeStart, 0, selection.start.line, 0))
    .trim();
  const contextAfter = editor.document
    .getText(
      new vscode.Range(
        selection.end.line,
        editor.document.lineAt(selection.end.line).text.length,
        contextAfterEnd,
        editor.document.lineAt(contextAfterEnd).text.length
      )
    )
    .trim();
  const knowledgeSnippets = await knowledgeStore.search(
    `${editor.document.languageId}\n${selectedText}\n${contextBefore}\n${contextAfter}`,
    settings.knowledgeTopK
  );

  return {
    requestId: createContentHash(
      [
        editor.document.uri.fsPath,
        reason,
        granularity,
        selectedText,
        settings.detailLevel,
        settings.professionalLevel
      ].join(":")
    ),
    reason,
    languageId: editor.document.languageId,
    filePath: editor.document.uri.fsPath,
    relativeFilePath,
    selectedText,
    granularity,
    detailLevel: settings.detailLevel,
    professionalLevel: settings.professionalLevel,
    sections: settings.sections,
    userGoal: settings.userGoal,
    customInstructions: settings.customInstructions,
    contextBefore,
    contextAfter,
    glossaryEntries,
    knowledgeSnippets
  };
}

function getProjectContext(
  document: vscode.TextDocument,
  logger?: ExtensionLogger
):
  | {
      workspaceRoot: string;
      relativeFilePath: string;
      workspaceStore: WorkspaceStore;
      knowledgeStore: KnowledgeStore;
    }
  | undefined {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

  if (!workspaceFolder) {
    return undefined;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const relativeFilePath = path.relative(workspaceRoot, document.uri.fsPath).replace(/\\/g, "/");
  const workspaceStore = new WorkspaceStore(workspaceRoot);
  const knowledgeStore = new KnowledgeStore(workspaceStore, logger);

  return {
    workspaceRoot,
    relativeFilePath,
    workspaceStore,
    knowledgeStore
  };
}

async function buildWorkspaceIndex(workspaceRoot: string): Promise<WorkspaceIndex> {
  const filePaths = await collectWorkspaceFiles(workspaceRoot, workspaceRoot);
  const fileSummaries = [];

  for (const filePath of filePaths) {
    const sourceCode = await fs.readFile(path.join(workspaceRoot, filePath), "utf8");
    const languageId = languageIdFromPath(filePath);
    fileSummaries.push(createWorkspaceFileSummary(filePath, languageId, sourceCode));
  }

  return {
    generatedAt: new Date().toISOString(),
    files: fileSummaries.sort((left, right) => left.path.localeCompare(right.path))
  };
}

async function collectWorkspaceFiles(
  workspaceRoot: string,
  currentPath: string
): Promise<string[]> {
  const directoryEntries = await fs.readdir(currentPath, { withFileTypes: true });
  const collectedFiles: string[] = [];

  for (const entry of directoryEntries) {
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (
        relativePath === ".git" ||
        relativePath === "dist" ||
        relativePath === "node_modules" ||
        relativePath === ".read-code-in-chinese"
      ) {
        continue;
      }

      collectedFiles.push(...(await collectWorkspaceFiles(workspaceRoot, absolutePath)));
      continue;
    }

    if (entry.isFile() && isSupportedWorkspaceFile(relativePath)) {
      collectedFiles.push(relativePath);
    }
  }

  return collectedFiles;
}

function languageIdFromPath(relativePath: string): string {
  const extension = path.extname(relativePath).toLowerCase();

  switch (extension) {
    case ".ts":
      return "typescript";
    case ".tsx":
      return "typescriptreact";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".jsx":
      return "javascriptreact";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".rs":
      return "rust";
    case ".json":
      return "json";
    case ".md":
      return "markdown";
    case ".yml":
    case ".yaml":
      return "yaml";
    default:
      return "plaintext";
  }
}

function updateStatusBar(statusBarItem: vscode.StatusBarItem): void {
  const settings = getSettings();
  statusBarItem.command = "readCodeInChinese.toggleAutoExplain";
  statusBarItem.text = settings.autoExplainEnabled
    ? "$(sparkle) RCIC Auto"
    : "$(circle-slash) RCIC Manual";
  statusBarItem.tooltip = settings.autoExplainEnabled
    ? "Auto explain is enabled. Click to disable."
    : "Auto explain is disabled. Click to enable.";
  statusBarItem.show();
}

async function toggleAutoExplain(statusBarItem: vscode.StatusBarItem): Promise<void> {
  const configuration = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  const currentValue = configuration.get<boolean>("autoExplain.enabled", false);
  const nextValue = !currentValue;

  await configuration.update(
    "autoExplain.enabled",
    nextValue,
    vscode.ConfigurationTarget.Workspace
  );
  updateStatusBar(statusBarItem);

  await vscode.window.showInformationMessage(
    `Read Code In Chinese: auto explain ${nextValue ? "enabled" : "disabled"} for this workspace.`
  );
}

function formatSelectionLabel(selection: vscode.Selection): string | undefined {
  if (selection.isEmpty) {
    return undefined;
  }

  return `L${selection.start.line + 1}:C${selection.start.character + 1} - L${selection.end.line + 1}:C${selection.end.character + 1}`;
}

function hasNonEmptySelection(editor: vscode.TextEditor | undefined): boolean {
  return Boolean(
    editor &&
      !editor.selection.isEmpty &&
      editor.document.getText(editor.selection).trim()
  );
}
