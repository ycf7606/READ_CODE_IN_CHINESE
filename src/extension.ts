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
import { KnowledgeStore } from "./knowledge/knowledgeStore";
import { createProvider } from "./providers/createProvider";
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

const ACTIVE_GLOSSARY_VIEW = "readCodeInChinese.glossaryView";

export function activate(context: vscode.ExtensionContext): void {
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
    if (message.type === "askQuestion") {
      await answerFollowUp(message.question);
    }
  });

  context.subscriptions.push(
    panel,
    statusBarItem,
    vscode.window.registerTreeDataProvider(ACTIVE_GLOSSARY_VIEW, glossaryTreeProvider)
  );

  const registeredCommands = [
    vscode.commands.registerCommand(
      "readCodeInChinese.explainSelection",
      async () => {
        await explainSelection("manual");
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
    )
  ];

  for (const command of registeredCommands) {
    context.subscriptions.push(command);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_NAMESPACE)) {
        updateStatusBar(statusBarItem);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(async () => {
      await refreshGlossaryForActiveEditor(false);
    }),
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
        await refreshGlossaryForActiveEditor(false);
      }
    }),
    vscode.window.onDidChangeTextEditorSelection(async (event) => {
      const settings = getSettings();

      if (!settings.autoExplainEnabled) {
        return;
      }

      if (!event.textEditor.selection || event.textEditor.selection.isEmpty) {
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
        void explainSelection("auto");
      }, settings.autoExplainDelayMs);
    })
  );

  updateStatusBar(statusBarItem);
  void refreshGlossaryForActiveEditor(false);

  async function explainSelection(reason: "manual" | "auto"): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: open a file before requesting an explanation."
      );
      return;
    }

    if (editor.selection.isEmpty) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: select some code before requesting an explanation."
      );
      return;
    }

    const selectedText = editor.document.getText(editor.selection).trim();

    if (!selectedText) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: the current selection is empty."
      );
      return;
    }

    const progressTitle =
      reason === "auto"
        ? "Read Code In Chinese: auto explanation"
        : "Read Code In Chinese: generating explanation";

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: progressTitle,
        cancellable: false
      },
      async () => {
        const projectContext = getProjectContext(editor.document);

        if (!projectContext) {
          await vscode.window.showWarningMessage(
            "Read Code In Chinese: open a workspace folder to enable caching and knowledge features."
          );
          return;
        }

        const { relativeFilePath, workspaceStore, knowledgeStore } = projectContext;
        await workspaceStore.ensureProjectDataDirectories();
        const glossaryEntries = await getOrCreateGlossary(
          workspaceStore,
          editor.document,
          relativeFilePath
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
        const provider = createProvider(getSettings());
        const response = await runExplanationWithFallback(provider, request);

        sessionState.request = request;
        sessionState.explanation = response;
        sessionState.chatHistory = [];
        panel.setState({
          explanation: response,
          chatHistory: sessionState.chatHistory,
          glossaryEntries: glossaryEntries,
          workspaceIndex: sessionState.workspaceIndex,
          statusMessage: `Source: ${response.source} | Latency: ${response.latencyMs} ms`
        });

        if (getSettings().autoOpenPanel || reason === "manual") {
          panel.show();
        }
      }
    );
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
        const projectContext = getProjectContext(editor.document);

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
          relativeFilePath
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
        const provider = createProvider(getSettings());
        const response = await runExplanationWithFallback(provider, request);

        sessionState.request = request;
        sessionState.explanation = response;
        sessionState.chatHistory = [];
        panel.setState({
          explanation: response,
          chatHistory: [],
          glossaryEntries,
          statusMessage: `Source: ${response.source} | Latency: ${response.latencyMs} ms`
        });
        panel.show();
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

    const projectContext = getProjectContext(editor.document);

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
      }
    );
  }

  async function refreshGlossaryForActiveEditor(forceRefresh: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      glossaryTreeProvider.setEntries([]);
      return;
    }

    const projectContext = getProjectContext(editor.document);

    if (!projectContext) {
      glossaryTreeProvider.setEntries([]);
      return;
    }

    const glossaryEntries = await getOrCreateGlossary(
      projectContext.workspaceStore,
      editor.document,
      projectContext.relativeFilePath,
      forceRefresh
    );

    sessionState.glossaryEntries = glossaryEntries;
    glossaryTreeProvider.setEntries(glossaryEntries);
    panel.setState({
      glossaryEntries
    });
  }

  async function editGlossaryEntry(entry?: GlossaryEntry): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !entry) {
      return;
    }

    const projectContext = getProjectContext(editor.document);

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
      false
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
      glossaryEntries: updatedEntries
    });

    const action = await vscode.window.showInformationMessage(
      `Updated glossary entry for ${entry.term}.`,
      "Re-run Explanation"
    );

    if (action === "Re-run Explanation" && sessionState.request) {
      await explainSelection("manual");
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

    const projectContext = getProjectContext(editor.document);

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

    await vscode.window.showInformationMessage(
      `Read Code In Chinese: imported ${importedDocuments.length} knowledge documents.`
    );
  }

  async function answerFollowUp(question: string): Promise<void> {
    if (!sessionState.request || !sessionState.explanation) {
      await vscode.window.showWarningMessage(
        "Read Code In Chinese: generate an explanation before asking follow-up questions."
      );
      return;
    }

    const provider = createProvider(getSettings());
    sessionState.chatHistory.push({
      role: "user",
      content: question,
      createdAt: new Date().toISOString()
    });

    const followUpResponse = await provider.answerFollowUp({
      request: sessionState.request,
      explanation: sessionState.explanation,
      question,
      chatHistory: sessionState.chatHistory
    });

    sessionState.chatHistory.push({
      role: "assistant",
      content: followUpResponse.answer,
      createdAt: new Date().toISOString()
    });
    panel.setState({
      chatHistory: sessionState.chatHistory,
      statusMessage: `Source: ${followUpResponse.source} | Latency: ${followUpResponse.latencyMs} ms`
    });
  }
}

export function deactivate(): void {}

async function runExplanationWithFallback(
  provider: ReturnType<typeof createProvider>,
  request: ExplanationRequest
): Promise<ExplanationResponse> {
  try {
    return await provider.explain(request);
  } catch (error) {
    const fallbackProvider = createProvider({
      ...getSettings(),
      providerId: "local",
      providerBaseUrl: "",
      providerModel: ""
    });
    const response = await fallbackProvider.explain(request);

    return {
      ...response,
      note: `Fell back to the local engine because the configured provider failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

async function getOrCreateGlossary(
  workspaceStore: WorkspaceStore,
  document: vscode.TextDocument,
  relativeFilePath: string,
  forceRefresh = false
): Promise<GlossaryEntry[]> {
  const currentSourceHash = createContentHash(document.getText());
  const existingCache = await workspaceStore.readGlossaryCache(relativeFilePath);

  if (!forceRefresh && existingCache && existingCache.sourceHash === currentSourceHash) {
    return existingCache.entries;
  }

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
    contextBefore,
    contextAfter,
    glossaryEntries,
    knowledgeSnippets
  };
}

function getProjectContext(document: vscode.TextDocument):
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
  const knowledgeStore = new KnowledgeStore(workspaceStore);

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
