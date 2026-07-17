import { promises as fs } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { buildPreprocessCandidatePool } from "./analysis/preprocess";
import {
  evaluatePreprocessPolicy,
  isPreprocessTriggerEnabled,
  PreprocessTrigger
} from "./analysis/preprocessPolicy";
import { attachSelectionDocumentation } from "./analysis/explanationPostprocess";
import { extractGlossaryEntries, mergeGlossaryWithUserOverrides } from "./analysis/glossary";
import { attachWordbookScopePaths } from "./analysis/wordbook";
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
  ExplanationGranularity,
  GlossaryCacheFile,
  GlossaryEntry,
  PromptProfileRequest,
  PromptProfileResponse,
  PreprocessedSymbolEntry,
  PreprocessProgress,
  WorkspaceIndex
} from "./contracts";
import { syncOfficialDocsForLanguage } from "./knowledge/officialDocs";
import { KnowledgeStore } from "./knowledge/knowledgeStore";
import { PreprocessStore } from "./knowledge/preprocessStore";
import {
  createPreprocessBuildFingerprint,
  isPreprocessCacheCompatible
} from "./knowledge/preprocessFingerprint";
import {
  buildCachedPreprocessExplanation,
  buildSymbolPreprocessCache
} from "./knowledge/symbolPreprocessBuilder";
import {
  TokenKnowledgeIdentity,
  TokenKnowledgeStore
} from "./knowledge/tokenKnowledgeStore";
import { ExtensionLogger } from "./logging/logger";
import { generateGlobalPrompt } from "./prompts/globalPromptProfile";
import { createProvider } from "./providers/createProvider";
import { ExplanationProvider } from "./providers/providerTypes";
import { SourceEditorSessionController } from "./runtime/sourceEditorSession";
import { WorkspaceStore } from "./storage/workspaceStore";
import { ExplanationPanel } from "./ui/explanationPanel";
import { GlossaryTreeProvider } from "./ui/glossaryTreeProvider";
import { SettingsPanel } from "./ui/settingsPanel";
import { createContentHash } from "./utils/hash";
import { inspectEditorSelection } from "./vscode/selectionInspector";

interface SessionState {
  request?: ExplanationRequest;
  explanation?: ExplanationResponse;
  chatHistory: ChatTurn[];
  workspaceIndex?: WorkspaceIndex;
  glossaryEntries: GlossaryEntry[];
  wordbookEntries: PreprocessedSymbolEntry[];
  wordbookRelativeFilePath?: string;
  wordbookSourceHash?: string;
  currentGranularity?: ExplanationGranularity;
  preprocessProgress?: PreprocessProgress;
}

interface ExplainSelectionOptions {
  showProgress: boolean;
  showWarnings: boolean;
  revealPanel: boolean;
}

const ACTIVE_GLOSSARY_VIEW = "readCodeInChinese.glossaryView";
const PREPROCESS_DELAY_MS = 500;

export function activate(context: vscode.ExtensionContext): void {
  const logger = new ExtensionLogger();
  const glossaryTreeProvider = new GlossaryTreeProvider();
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  const sessionState: SessionState = {
    chatHistory: [],
    glossaryEntries: [],
    wordbookEntries: []
  };
  let autoExplainTimeout: NodeJS.Timeout | undefined;
  let preprocessTimeout: NodeJS.Timeout | undefined;
  const sourceEditorSession = new SourceEditorSessionController<vscode.TextEditor>(
    vscode.window.activeTextEditor
  );

  const panel = new ExplanationPanel(async (message) => {
    if (message.type === "ready") {
      syncPanelContext(getPreferredSourceEditor());
      await refreshWordbookForActiveEditor();
      return;
    }

    if (message.type === "openSettings") {
      settingsPanel.show(getSettings());
      return;
    }

    if (message.type === "explainCurrentSelection") {
      await explainSelection("manual", {
        showProgress: false,
        showWarnings: true,
        revealPanel: false
      });
      return;
    }

    if (message.type === "toggleSelectionWatch") {
      panel.setWatchingSelection(message.enabled);
      clearTimeout(autoExplainTimeout);

      if (!message.enabled) {
        const canceledExplanation = cancelExplainTask("Selection watching paused");
        if (canceledExplanation) {
          panel.setState({
            isLoading: false,
            statusMessage: "已暂停跟随选区，当前请求已取消。"
          });
        }
        syncPanelContext(getPreferredSourceEditor());
        return;
      }

      syncPanelContext(getPreferredSourceEditor());
      if (hasNonEmptySelection(getPreferredSourceEditor())) {
        await explainSelection("auto", {
          showProgress: false,
          showWarnings: false,
          revealPanel: false
        });
      }
      return;
    }

    if (message.type === "setReasoningEffort") {
      await persistConfigurationValue("provider.reasoningEffort", message.reasoningEffort);
      return;
    }

    if (message.type === "askQuestion") {
      await answerFollowUp(message.question);
    }
  });
  const settingsPanel = new SettingsPanel(async (message) => {
    if (message.type === "ready") {
      settingsPanel.show(getSettings());
      return;
    }

    if (message.type === "runPreprocess") {
      await runPreprocessForActiveEditor(true);
      return;
    }

    if (message.type === "generatePrompt") {
      const currentSettings = getSettings();
      const providerSettings = {
        ...currentSettings,
        providerId: message.payload.providerId,
        providerBaseUrl: message.payload.providerBaseUrl.trim(),
        providerModel: message.payload.providerModel.trim(),
        providerApiKeyEnvVar:
          message.payload.providerApiKeyEnvVar.trim() || currentSettings.providerApiKeyEnvVar,
        providerFallbacks: sanitizeProviderFallbacks(message.payload.providerFallbacks),
        providerTimeoutMs: sanitizeNumber(
          message.payload.providerTimeoutMs,
          currentSettings.providerTimeoutMs,
          { minimum: 1000 }
        ),
        providerRequireTrustedWorkspace: message.payload.providerRequireTrustedWorkspace,
        providerTemperature: sanitizeNumber(
          message.payload.temperature,
          currentSettings.providerTemperature,
          { minimum: 0, maximum: 2 }
        ),
        providerTopP: sanitizeNumber(message.payload.topP, currentSettings.providerTopP, {
          minimum: 0,
          maximum: 1
        }),
        providerMaxTokens: Math.round(
          sanitizeNumber(message.payload.maxTokens, currentSettings.providerMaxTokens, {
            minimum: 64
          })
        ),
        providerReasoningEffort: message.payload.reasoningEffort
      };
      const promptRequest: PromptProfileRequest = {
        occupation: message.payload.occupation,
        professionalLevel: message.payload.professionalLevel,
        detailLevel: message.payload.detailLevel,
        sections: message.payload.sections.length ? message.payload.sections : ["summary"],
        userGoal: message.payload.userGoal.trim(),
        reasoningEffort: message.payload.reasoningEffort,
        temperature: providerSettings.providerTemperature,
        topP: providerSettings.providerTopP,
        maxTokens: providerSettings.providerMaxTokens
      };

      settingsPanel.setStatusMessage("Generating prompt profile...");

      try {
        const provider = createWorkspaceAwareProvider(providerSettings, logger);
        const response = await runPromptProfileWithFallback(provider, promptRequest, logger);

        settingsPanel.setDraftGlobalPrompt(response.prompt);
        settingsPanel.setStatusMessage(
          `Prompt generated by ${response.source} in ${response.latencyMs} ms.${
            response.note ? ` ${response.note}` : ""
          }`
        );

        logger.info("Prompt profile generated", {
          source: response.source,
          latencyMs: response.latencyMs,
          usedRemoteProvider: provider.id === "openai-compatible"
        });
      } catch (error) {
        logger.error("Prompt profile generation failed", error);
        settingsPanel.setStatusMessage(
          `Prompt generation failed: ${error instanceof Error ? error.message : String(error)}`
        );
        await vscode.window.showWarningMessage(
          `Read Code In Chinese: prompt generation failed. ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      return;
    }

    if (message.type === "saveSettings") {
      await saveSettingsFromPanel(message.payload);
      settingsPanel.show(getSettings());
      settingsPanel.setStatusMessage("Settings saved.");
      logger.info("Settings updated from settings panel", summarizeSettings(getSettings()));
    }
  });

  context.subscriptions.push(
    logger,
    panel,
    settingsPanel,
    statusBarItem,
    {
      dispose: () => {
        clearTimeout(autoExplainTimeout);
        clearTimeout(preprocessTimeout);
        sourceEditorSession.dispose();
      }
    },
    vscode.window.registerTreeDataProvider(ACTIVE_GLOSSARY_VIEW, glossaryTreeProvider)
  );

  logger.info("Extension activated");
  logger.info("Effective settings", summarizeSettings(getSettings()));

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
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.openSettingsPanel",
      () => {
        settingsPanel.show(getSettings());
      }
    ),
    vscode.commands.registerCommand(
      "readCodeInChinese.buildTokenKnowledgeForActiveLanguage",
      async () => {
        await runPreprocessForActiveEditor(true);
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
        logger.info("Effective settings", summarizeSettings(getSettings()));
        cancelPreprocessTask("Configuration changed");
        updateStatusBar(statusBarItem);
        syncPanelContext(getPreferredSourceEditor());
        void refreshWordbookForActiveEditor();
        schedulePreprocessForActiveEditor("idle");
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (!editor) {
        syncPanelContext(getPreferredSourceEditor());
        return;
      }

      const relativeFilePath = getRelativeFilePath(editor);
      const switchedExplanationFile = Boolean(
        sessionState.request && sessionState.request.relativeFilePath !== relativeFilePath
      );
      sourceEditorSession.trackEditor(editor);
      const canceledExplanation = cancelExplainTask("Active editor changed");
      const canceledFollowUp = cancelFollowUpTask("Active editor changed");
      cancelPreprocessTask("Active editor changed");
      if (switchedExplanationFile || canceledExplanation || canceledFollowUp) {
        resetExplanationForSelectionChange(
          switchedExplanationFile
            ? "已切换文件，请选择代码后生成解释。"
            : "编辑器状态已变化，请重新生成解释。"
        );
      }
      logger.info("Active editor changed", {
        filePath: editor?.document.uri.fsPath,
        languageId: editor?.document.languageId
      });
      syncPanelContext(editor);
      await refreshGlossaryForActiveEditor(false);
      await refreshWordbookForEditor(editor);
      schedulePreprocessForActiveEditor("idle");
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length === 0) {
        return;
      }

      const editor = getPreferredSourceEditor();

      if (!editor || editor.document.uri.toString() !== event.document.uri.toString()) {
        return;
      }

      clearTimeout(autoExplainTimeout);
      clearTimeout(preprocessTimeout);
      sourceEditorSession.resetAutoExplainSignature();
      const canceledExplanation = cancelExplainTask("Active document changed");
      const canceledFollowUp = cancelFollowUpTask("Active document changed");
      cancelPreprocessTask("Active document changed");

      if (
        canceledExplanation ||
        canceledFollowUp ||
        sessionState.request?.relativeFilePath === getRelativeFilePath(editor)
      ) {
        resetExplanationForSelectionChange("文件内容已变化，请重新生成解释。");
      }

      syncPanelContext(editor);
      schedulePreprocessForActiveEditor("idle");
    }),
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
        logger.info("Active document saved", {
          filePath: document.uri.fsPath
        });
        const canceledExplanation = cancelExplainTask("Active document saved");
        const canceledFollowUp = cancelFollowUpTask("Active document saved");
        cancelPreprocessTask("Active document saved");
        if (canceledExplanation || canceledFollowUp) {
          resetExplanationForSelectionChange("文件已保存，请重新生成解释。");
        }
        await refreshGlossaryForActiveEditor(false);
        await refreshWordbookForActiveEditor();
        schedulePreprocessForActiveEditor("save");
      }
    }),
    vscode.window.onDidChangeTextEditorSelection(async (event) => {
      sourceEditorSession.trackEditor(event.textEditor);
      recordSelectionFocus(event.textEditor, event.textEditor.selection);
      clearTimeout(autoExplainTimeout);

      if (!event.textEditor.selection || event.textEditor.selection.isEmpty) {
        sourceEditorSession.resetAutoExplainSignature();
        cancelExplainTask("Selection cleared");
        cancelFollowUpTask("Selection cleared");
        resetExplanationForSelectionChange("请选择代码后再生成解释。");
        syncPanelContext(event.textEditor);
        return;
      }

      const currentSelectionText = event.textEditor.document
        .getText(event.textEditor.selection)
        .trim();

      if (!currentSelectionText) {
        sourceEditorSession.resetAutoExplainSignature();
        cancelExplainTask("Selection contains no code");
        cancelFollowUpTask("Selection contains no code");
        resetExplanationForSelectionChange("当前选区没有可解释的代码。");
        syncPanelContext(event.textEditor);
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

      if (!sourceEditorSession.acceptAutoExplainSignature(signature)) {
        syncPanelContext(event.textEditor);
        return;
      }

      cancelExplainTask("Selection changed");
      cancelFollowUpTask("Selection changed");
      const shouldWatchSelection =
        panel.isWatchingSelection() ||
        (getSettings().autoExplainEnabled && !panel.isOpen());
      resetExplanationForSelectionChange(
        shouldWatchSelection ? "等待选区稳定后生成解释…" : "选区已变化，请手动生成解释。",
        shouldWatchSelection
      );
      syncPanelContext(event.textEditor);

      if (!shouldWatchSelection) {
        return;
      }

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
  syncPanelContext(getPreferredSourceEditor());
  void refreshGlossaryForActiveEditor(false);
  void refreshWordbookForActiveEditor();
  schedulePreprocessForActiveEditor("idle");
  if (!context.globalState.get<boolean>("readCodeInChinese.onboardingShown")) {
    void context.globalState.update("readCodeInChinese.onboardingShown", true);
    setTimeout(() => {
      settingsPanel.show(getSettings());
    }, 250);
  }

  function cancelPreprocessTask(reason: string): void {
    clearTimeout(preprocessTimeout);
    const task = sourceEditorSession.cancelTask("preprocess");

    if (task) {
      const relativeFilePath =
        sessionState.preprocessProgress?.relativeFilePath ??
        getRelativeFilePath(vscode.window.activeTextEditor);
      logger.info("Canceled preprocess task", { reason, version: task.version });
      sessionState.preprocessProgress = {
        ...(sessionState.preprocessProgress ?? {
          totalCandidates: 0,
          processedCandidates: 0,
          totalSteps: 5,
          completedSteps: 0,
          batchCount: 0,
          startedAt: new Date().toISOString()
        }),
        relativeFilePath,
        status: "canceled",
        message: reason,
        completedAt: new Date().toISOString()
      };
      panel.setState({
        preprocessProgress: getVisiblePreprocessProgress(
          sessionState.preprocessProgress,
          vscode.window.activeTextEditor
        )
      });
    }
  }

  function cancelExplainTask(reason: string): boolean {
    const task = sourceEditorSession.cancelTask("explain");

    if (!task) {
      return false;
    }

    logger.info("Canceled explanation task", { reason, version: task.version });
    return true;
  }

  function cancelFollowUpTask(reason: string): boolean {
    const task = sourceEditorSession.cancelTask("follow-up");

    if (!task) {
      return false;
    }

    logger.info("Canceled follow-up task", { reason, version: task.version });
    return true;
  }

  function resetExplanationForSelectionChange(
    statusMessage: string,
    isLoading = false
  ): void {
    sessionState.request = undefined;
    sessionState.explanation = undefined;
    sessionState.chatHistory = [];
    sessionState.currentGranularity = undefined;
    panel.setState({
      explanation: undefined,
      chatHistory: [],
      currentSelectionInsight: undefined,
      isLoading,
      statusMessage
    });
  }

  function schedulePreprocessForActiveEditor(trigger: PreprocessTrigger): void {
    clearTimeout(preprocessTimeout);
    const settings = getSettings();

    if (!isPreprocessTriggerEnabled(settings, trigger)) {
      return;
    }

    preprocessTimeout = setTimeout(() => {
      void runPreprocessForActiveEditor(false, trigger);
    }, PREPROCESS_DELAY_MS);
  }

  async function explainSelection(
    reason: "manual" | "auto",
    options: ExplainSelectionOptions
  ): Promise<void> {
    const editor = getPreferredSourceEditor();

    if (!editor) {
      await handleSelectionFailure(
        "Read Code In Chinese: open a file before requesting an explanation.",
        options
      );
      return;
    }

    const selection = editor.selection;

    if (selection.isEmpty) {
      await handleSelectionFailure(
        "Read Code In Chinese: select some code before requesting an explanation.",
        options
      );
      return;
    }

    const selectedText = editor.document.getText(selection).trim();

    if (!selectedText) {
      await handleSelectionFailure(
        "Read Code In Chinese: the current selection is empty.",
        options
      );
      return;
    }

    if (cancelFollowUpTask("New selection explanation started")) {
      sessionState.chatHistory = [];
      panel.setState({ chatHistory: [] });
    }
    const task = sourceEditorSession.startTask("explain");
    const isCurrentTask = (): boolean =>
      sourceEditorSession.isTaskCurrent("explain", task.version) &&
      !task.controller.signal.aborted;

    const execute = async (): Promise<void> => {
      if (!isCurrentTask()) {
        return;
      }

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

      if (!isCurrentTask()) {
        return;
      }

      const granularity = inferGranularity(
        selectedText,
        selection.end.line - selection.start.line + 1
      );
      const sourceHash = createContentHash(editor.document.getText());
      const shouldRevealPanel =
        options.revealPanel || (!panel.isWatchingSelection() && getSettings().autoOpenPanel);

      if (shouldRevealPanel) {
        panel.show();
      }

      panel.setState({
        isWatchingSelection: panel.isWatchingSelection(),
        currentFile: relativeFilePath,
        currentSelectionLabel: formatSelectionLabel(selection),
        hasSelection: true,
        currentGranularity: granularity,
        isLoading: true,
        reasoningEffort: getSettings().providerReasoningEffort,
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

      if (!isCurrentTask()) {
        return;
      }

      sessionState.glossaryEntries = glossaryEntries;
      glossaryTreeProvider.setEntries(glossaryEntries);
      const preprocessStore = new PreprocessStore(workspaceStore);
      const tokenKnowledgeStore = new TokenKnowledgeStore(workspaceStore, logger);

      const request = await createExplanationRequest(
        editor,
        selectedText,
        granularity,
        reason,
        glossaryEntries,
        knowledgeStore,
        relativeFilePath,
        selection
      );

      if (!isCurrentTask()) {
        return;
      }

      panel.setState({
        currentSelectionInsight: request.selectionInsight
      });
      let response: ExplanationResponse | undefined;

      if (granularity === "token") {
        const settings = getSettings();
        const tokenIdentity = createTokenKnowledgeIdentity(request);
        const preprocessedEntry = await preprocessStore.findEntry(
          relativeFilePath,
          sourceHash,
          selectedText,
          createPreprocessBuildFingerprint(settings)
        );

        if (preprocessedEntry) {
          logger.info("Preprocess cache hit", {
            relativeFilePath,
            term: selectedText
          });
          response = buildCachedPreprocessExplanation(request, preprocessedEntry);
        } else {
          const cachedToken = await tokenKnowledgeStore.find(
            editor.document.languageId,
            tokenIdentity
          );

          if (cachedToken) {
            logger.info("Token knowledge cache hit", {
              languageId: editor.document.languageId,
              term: selectedText
            });
            response = {
              ...cachedToken.explanation,
              requestId: request.requestId,
              selectionText: selectedText,
              granularity: "token",
              source: "token-knowledge-cache",
              latencyMs: 0,
              note:
                cachedToken.explanation.note ??
                "Used cached token knowledge built from a previous remote explanation."
            };
          }
        }
      }

      if (!response) {
        const provider = createWorkspaceAwareProvider(getSettings(), logger);
        response = await runExplanationWithFallback(provider, request, logger, task.controller.signal);
      }

      response = attachSelectionDocumentation(response, request);

      if (!isCurrentTask()) {
        return;
      }

      if (granularity === "token" && response.source === "openai-compatible") {
        await tokenKnowledgeStore.upsert(
          editor.document.languageId,
          createTokenKnowledgeIdentity(request),
          response
        );
      }

      if (!isCurrentTask()) {
        logger.info("Dropped stale explanation result", {
          requestId: request.requestId,
          version: task.version
        });
        return;
      }

      sessionState.request = request;
      sessionState.explanation = response;
      sessionState.currentGranularity = granularity;
      sessionState.chatHistory = [];
      panel.setState({
        explanation: response,
        chatHistory: sessionState.chatHistory,
        glossaryEntries: glossaryEntries.length > 0 ? glossaryEntries : response.glossaryHints,
        wordbookEntries: getVisibleWordbookEntries(editor),
        workspaceIndex: sessionState.workspaceIndex,
        isWatchingSelection: panel.isWatchingSelection(),
        currentFile: relativeFilePath,
        currentSelectionLabel: formatSelectionLabel(selection),
        hasSelection: true,
        currentGranularity: granularity,
        currentSelectionInsight: request.selectionInsight,
        isLoading: false,
        reasoningEffort: getSettings().providerReasoningEffort,
        lastUpdatedAt: new Date().toLocaleString(),
        statusMessage: `Source: ${response.source} | Latency: ${response.latencyMs} ms`
      });

      logger.info("Explanation completed", {
        reason,
        requestId: request.requestId,
        version: task.version,
        source: response.source,
        latencyMs: response.latencyMs,
        knowledgeUsed: response.knowledgeUsed
      });

      if (shouldRevealPanel) {
        panel.show();
        syncPanelContext(editor);
      }

      schedulePreprocessForActiveEditor("idle");
    };

    logger.info("Explanation requested", {
      reason,
      filePath: editor.document.uri.fsPath,
      selection: formatSelectionLabel(selection),
      version: task.version
    });

    const handleExplanationError = async (error: unknown): Promise<void> => {
      if (!sourceEditorSession.isTaskCurrent("explain", task.version)) {
        logger.info("Dropped stale explanation error", {
          reason,
          version: task.version
        });
        return;
      }

      logger.error("Selection explanation failed", error);
      const message = `Explanation failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      panel.setState({
        isLoading: false,
        reasoningEffort: getSettings().providerReasoningEffort,
        statusMessage: message
      });

      if (options.showWarnings) {
        await vscode.window.showWarningMessage(`Read Code In Chinese: ${message}`);
      }
    };

    if (options.showProgress) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Read Code In Chinese: generating explanation",
          cancellable: false
        },
        async () => {
          try {
            await execute();
          } catch (error) {
            if (isAbortLikeError(error)) {
              logger.info("Selection explanation aborted", {
                reason,
                version: task.version
              });
              if (sourceEditorSession.isTaskCurrent("explain", task.version)) {
                panel.setState({
                  isLoading: false,
                  reasoningEffort: getSettings().providerReasoningEffort,
                  statusMessage: "Explanation request canceled."
                });
              }
              return;
            }

            await handleExplanationError(error);
          } finally {
            sourceEditorSession.finishTask("explain", task.version);
          }
        }
      );
      return;
    }

    try {
      await execute();
    } catch (error) {
      if (isAbortLikeError(error)) {
        logger.info("Selection explanation aborted", {
          reason,
          version: task.version
        });
        if (sourceEditorSession.isTaskCurrent("explain", task.version)) {
          panel.setState({
            isLoading: false,
            reasoningEffort: getSettings().providerReasoningEffort,
            statusMessage: "Explanation request canceled."
          });
        }
        return;
      }

      await handleExplanationError(error);
    } finally {
      sourceEditorSession.finishTask("explain", task.version);
    }
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
        const provider = createWorkspaceAwareProvider(getSettings(), logger);
        const response = await runExplanationWithFallback(provider, request, logger);

        sessionState.request = request;
        sessionState.explanation = response;
        sessionState.chatHistory = [];
        panel.setState({
          explanation: response,
          chatHistory: [],
          glossaryEntries,
          wordbookEntries: getVisibleWordbookEntries(editor),
          isWatchingSelection: panel.isWatchingSelection(),
          currentFile: relativeFilePath,
          currentSelectionLabel: "Entire file",
          hasSelection: false,
          currentGranularity: "file",
          currentSelectionInsight: undefined,
          isLoading: false,
          reasoningEffort: getSettings().providerReasoningEffort,
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
          wordbookEntries: getVisibleWordbookEntries(editor),
          isWatchingSelection: panel.isWatchingSelection(),
          currentFile: projectContext.relativeFilePath,
          currentGranularity: "workspace",
          isLoading: false,
          reasoningEffort: getSettings().providerReasoningEffort,
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
        wordbookEntries: [],
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
        wordbookEntries: [],
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

    const task = sourceEditorSession.startTask("follow-up");
    const provider = createWorkspaceAwareProvider(getSettings(), logger);
    const previousChatHistory = [...sessionState.chatHistory];
    const userTurn: ChatTurn = {
      role: "user",
      content: question,
      createdAt: new Date().toISOString()
    };
    sessionState.chatHistory = [...previousChatHistory, userTurn];
    panel.setState({
      chatHistory: sessionState.chatHistory,
      isLoading: true,
      reasoningEffort: getSettings().providerReasoningEffort,
      statusMessage: "Generating follow-up answer..."
    });

    let followUpResponse;

    try {
      followUpResponse = await runFollowUpWithFallback(
        provider,
        {
          request: sessionState.request,
          explanation: sessionState.explanation,
          question,
          chatHistory: [...previousChatHistory, userTurn]
        },
        logger,
        task.controller.signal
      );
    } catch (error) {
      if (
        !sourceEditorSession.isTaskCurrent("follow-up", task.version) ||
        task.controller.signal.aborted
      ) {
        logger.info("Dropped stale follow-up error", {
          version: task.version
        });
        return;
      }

      if (isAbortLikeError(error)) {
        logger.info("Follow-up request aborted", {
          version: task.version
        });
        if (sourceEditorSession.isTaskCurrent("follow-up", task.version)) {
          sessionState.chatHistory = previousChatHistory;
          panel.setState({
            chatHistory: previousChatHistory,
            isLoading: false,
            reasoningEffort: getSettings().providerReasoningEffort,
            statusMessage: "Follow-up request canceled."
          });
          sourceEditorSession.finishTask("follow-up", task.version);
        }
        return;
      }

      logger.error("Follow-up request failed", error);
      if (sourceEditorSession.isTaskCurrent("follow-up", task.version)) {
        sessionState.chatHistory = previousChatHistory;
        panel.setState({
          chatHistory: previousChatHistory,
          isLoading: false,
          reasoningEffort: getSettings().providerReasoningEffort,
          statusMessage: `Follow-up failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        });
        sourceEditorSession.finishTask("follow-up", task.version);
      }
      await vscode.window.showWarningMessage(
        `Read Code In Chinese: follow-up failed. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return;
    }

    if (
      !sourceEditorSession.isTaskCurrent("follow-up", task.version) ||
      task.controller.signal.aborted
    ) {
      logger.info("Dropped stale follow-up result", {
        version: task.version
      });
      return;
    }

    sessionState.chatHistory = [
      ...previousChatHistory,
      userTurn,
      {
        role: "assistant",
        content: followUpResponse.answer,
        createdAt: new Date().toISOString()
      }
    ];
    panel.setState({
      chatHistory: sessionState.chatHistory,
      isLoading: false,
      reasoningEffort: getSettings().providerReasoningEffort,
      lastUpdatedAt: new Date().toLocaleString(),
      statusMessage: `Source: ${followUpResponse.source} | Latency: ${followUpResponse.latencyMs} ms`
    });

    sourceEditorSession.finishTask("follow-up", task.version);
  }

  async function handleSelectionFailure(
    message: string,
    options: ExplainSelectionOptions
  ): Promise<void> {
    logger.warn("Selection explanation skipped", message);

    panel.setState({
      isWatchingSelection: panel.isWatchingSelection(),
      isLoading: false,
      reasoningEffort: getSettings().providerReasoningEffort,
      statusMessage: message,
      currentFile: getPreferredSourceEditor()
        ? getProjectContext(getPreferredSourceEditor()!.document, logger)?.relativeFilePath ??
          path.basename(getPreferredSourceEditor()!.document.uri.fsPath)
        : undefined,
      currentSelectionLabel: getPreferredSourceEditor()
        ? formatSelectionLabel(getPreferredSourceEditor()!.selection)
        : undefined
    });

    if (options.showWarnings) {
      await vscode.window.showWarningMessage(message);
    }
  }

  function setWordbookState(
    relativeFilePath: string | undefined,
    sourceHash: string | undefined,
    entries: PreprocessedSymbolEntry[]
  ): void {
    sessionState.wordbookRelativeFilePath = relativeFilePath;
    sessionState.wordbookSourceHash = sourceHash;
    sessionState.wordbookEntries = sanitizeWordbookEntries(entries);
  }

  function sanitizeWordbookEntries(
    entries: PreprocessedSymbolEntry[]
  ): PreprocessedSymbolEntry[] {
    return entries.filter((entry) => {
      return (
        entry.isPlaceholder !== true &&
        !/作用需要结合附近代码继续确认/.test(entry.summary)
      );
    });
  }

  function getVisibleWordbookEntries(editor: vscode.TextEditor | undefined): PreprocessedSymbolEntry[] {
    if (!editor) {
      return [];
    }

    const relativeFilePath = getRelativeFilePath(editor);

    if (
      !relativeFilePath ||
      relativeFilePath !== sessionState.wordbookRelativeFilePath ||
      sessionState.wordbookSourceHash !== createContentHash(editor.document.getText())
    ) {
      return [];
    }

    return attachWordbookScopePaths(
      sessionState.wordbookEntries,
      editor.document.getText(),
      editor.document.languageId
    );
  }

  async function refreshWordbookForActiveEditor(): Promise<void> {
    await refreshWordbookForEditor(getPreferredSourceEditor());
  }

  async function refreshWordbookForEditor(
    editor: vscode.TextEditor | undefined
  ): Promise<void> {
    if (!editor) {
      setWordbookState(undefined, undefined, []);
      panel.setState({
        wordbookEntries: []
      });
      return;
    }

    const projectContext = getProjectContext(editor.document, logger);

    if (!projectContext) {
      setWordbookState(undefined, undefined, []);
      panel.setState({
        wordbookEntries: []
      });
      return;
    }

    const preprocessStore = new PreprocessStore(projectContext.workspaceStore);
    const sourceHash = createContentHash(editor.document.getText());
    const cacheFile = await preprocessStore.read(projectContext.relativeFilePath);
    const expectedFingerprint = createPreprocessBuildFingerprint(getSettings());

    if (
      cacheFile &&
      cacheFile.sourceHash === sourceHash &&
      isPreprocessCacheCompatible(cacheFile, expectedFingerprint)
    ) {
      const sanitizedEntries = sanitizeWordbookEntries(cacheFile.entries);

      if (sanitizedEntries.length !== cacheFile.entries.length) {
        await preprocessStore.write(projectContext.relativeFilePath, {
          ...cacheFile,
          generatedAt: new Date().toISOString(),
          entries: sanitizedEntries
        });
      }

      setWordbookState(projectContext.relativeFilePath, cacheFile.sourceHash, sanitizedEntries);
    } else {
      setWordbookState(projectContext.relativeFilePath, sourceHash, []);
    }

    panel.setState({
      wordbookEntries: getVisibleWordbookEntries(editor)
    });
  }

  function syncPanelContext(editor: vscode.TextEditor | undefined): void {
    const sourceEditor = getPreferredSourceEditor(editor);
    const projectContext = sourceEditor ? getProjectContext(sourceEditor.document, logger) : undefined;
    const currentGranularity = inferCurrentGranularity(sourceEditor);
    const currentSelectionText = sourceEditor?.selection.isEmpty
      ? undefined
      : sourceEditor?.document.getText(sourceEditor.selection).trim();
    const currentRequest = sessionState.request;
    const currentSelectionInsight =
      currentSelectionText &&
      currentRequest &&
      currentRequest.relativeFilePath === projectContext?.relativeFilePath &&
      currentRequest.selectedText.trim() === currentSelectionText
        ? currentRequest.selectionInsight
        : undefined;

    panel.setState({
      isWatchingSelection: panel.isWatchingSelection(),
      currentFile: projectContext?.relativeFilePath ?? sourceEditor?.document.fileName,
      currentSelectionLabel: sourceEditor ? formatSelectionLabel(sourceEditor.selection) : undefined,
      hasSelection: hasNonEmptySelection(sourceEditor),
      currentGranularity,
      currentSelectionInsight,
      wordbookEntries: getVisibleWordbookEntries(sourceEditor),
      reasoningEffort: getSettings().providerReasoningEffort,
      preprocessProgress: getVisiblePreprocessProgress(sessionState.preprocessProgress, sourceEditor)
    });
  }

  async function runPreprocessForActiveEditor(
    showNotifications: boolean,
    trigger: PreprocessTrigger = "manual"
  ): Promise<void> {
    const editor = getPreferredSourceEditor();

    if (!editor) {
      return;
    }

    const projectContext = getProjectContext(editor.document, logger);

    if (!projectContext) {
      return;
    }

    const settings = getSettings();

    if (settings.providerId !== "openai-compatible") {
      if (showNotifications) {
        await vscode.window.showInformationMessage(
          "Read Code In Chinese: 文件预处理需要启用 OpenAI 兼容远端服务。"
        );
      }
      return;
    }

    const sourceText = editor.document.getText();
    const policyDecision = evaluatePreprocessPolicy({
      trigger,
      mode: settings.preprocessMode,
      workspaceTrusted: vscode.workspace.isTrusted,
      requireTrustedWorkspace: settings.providerRequireTrustedWorkspace,
      relativeFilePath: projectContext.relativeFilePath,
      fileBytes: Buffer.byteLength(sourceText, "utf8"),
      maxFileBytes: settings.preprocessMaxFileBytes,
      excludePatterns: settings.preprocessExclude
    });

    if (!policyDecision.allowed) {
      logger.info("Preprocess skipped by policy", {
        trigger,
        relativeFilePath: projectContext.relativeFilePath,
        reason: policyDecision.reason
      });

      if (showNotifications) {
        panel.setState({ statusMessage: policyDecision.reason });
        await vscode.window.showWarningMessage(
          `Read Code In Chinese: ${policyDecision.reason ?? "preprocessing is not allowed."}`
        );
      }
      return;
    }

    const provider = createProvider(settings, logger);

    if (!provider.preprocessSymbols) {
      return;
    }

    const task = sourceEditorSession.startTask("preprocess");
    const sourceHash = createContentHash(sourceText);
    const documentVersion = editor.document.version;
    const isCurrentTask = (): boolean =>
      sourceEditorSession.isTaskCurrent("preprocess", task.version) &&
      !task.controller.signal.aborted &&
      editor.document.version === documentVersion;

    if (
      sessionState.wordbookRelativeFilePath !== projectContext.relativeFilePath ||
      sessionState.wordbookSourceHash !== sourceHash
    ) {
      setWordbookState(projectContext.relativeFilePath, sourceHash, []);
    }

    if (showNotifications && !panel.isVisible()) {
      panel.show();
    }

    try {
      await projectContext.workspaceStore.ensureProjectDataDirectories();
      const glossaryEntries = await getOrCreateGlossary(
        projectContext.workspaceStore,
        editor.document,
        projectContext.relativeFilePath,
        false,
        logger
      );

      if (!isCurrentTask()) {
        return;
      }

      const rawCandidatePool = buildPreprocessCandidatePool(glossaryEntries);
      const candidatePool = rawCandidatePool.slice(
        0,
        Math.max(1, Math.round(settings.preprocessMaxCandidates))
      );

      if (candidatePool.length < rawCandidatePool.length) {
        logger.info("Preprocess candidate pool capped", {
          relativeFilePath: projectContext.relativeFilePath,
          originalCount: rawCandidatePool.length,
          cappedCount: candidatePool.length
        });
      }

      sessionState.preprocessProgress = {
        status: "running",
        totalCandidates: 0,
        processedCandidates: 0,
        totalSteps: 5,
        completedSteps: 1,
        batchCount: 0,
        candidatePoolCount: candidatePool.length,
        relativeFilePath: projectContext.relativeFilePath,
        currentStep: "Preparing candidate pool",
        message: `Prepared ${candidatePool.length} preprocessable symbols for this file.`,
        startedAt: new Date().toISOString()
      };
      panel.setState({
        preprocessProgress: sessionState.preprocessProgress,
        wordbookEntries: getVisibleWordbookEntries(editor)
      });

      const result = await buildSymbolPreprocessCache({
        editorText: sourceText,
        languageId: editor.document.languageId,
        filePath: editor.document.uri.fsPath,
        relativeFilePath: projectContext.relativeFilePath,
        settings,
        glossaryEntries,
        candidatePool,
        workspaceStore: projectContext.workspaceStore,
        provider,
        logger,
        signal: task.controller.signal,
        getPriorityScore: (sourceLine) =>
          sourceEditorSession.getSelectionPriorityScore(
            projectContext.relativeFilePath,
            sourceLine
          ),
        onCacheUpdate: (cacheFile) => {
          if (
            !isCurrentTask()
          ) {
            return;
          }

          setWordbookState(
            projectContext.relativeFilePath,
            cacheFile.sourceHash,
            cacheFile.entries
          );
          panel.setState({
            wordbookEntries: getVisibleWordbookEntries(editor)
          });
        },
        onProgress: (progress) => {
          if (
            !isCurrentTask()
          ) {
            return;
          }

          sessionState.preprocessProgress = progress;
          panel.setState({
            preprocessProgress: progress
          });
        }
      });

      if (
        !isCurrentTask()
      ) {
        logger.info("Dropped stale preprocess result", {
          version: task.version,
          relativeFilePath: projectContext.relativeFilePath
        });
        return;
      }

      if (result) {
        setWordbookState(
          projectContext.relativeFilePath,
          result.cacheFile.sourceHash,
          result.cacheFile.entries
        );
        panel.setState({
          wordbookEntries: getVisibleWordbookEntries(editor)
        });
      }

      if (result && showNotifications) {
        await vscode.window.showInformationMessage(
          `Read Code In Chinese: preprocessed ${result.cacheFile.entries.length} symbols for ${projectContext.relativeFilePath}.`
        );
      }
    } catch (error) {
      if (
        !isCurrentTask()
      ) {
        logger.info("Dropped stale preprocess error", {
          version: task.version,
          relativeFilePath: projectContext.relativeFilePath
        });
        return;
      }

      if (isAbortLikeError(error)) {
        logger.info("Preprocess request aborted", {
          version: task.version,
          relativeFilePath: projectContext.relativeFilePath
        });
        return;
      }

      logger.error("Preprocess request failed", error);
      sessionState.preprocessProgress = {
        ...(sessionState.preprocessProgress ?? {
          totalCandidates: 0,
          processedCandidates: 0,
          totalSteps: 5,
          completedSteps: 0,
          batchCount: 0,
          startedAt: new Date().toISOString()
        }),
        relativeFilePath: projectContext.relativeFilePath,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString()
      };
      panel.setState({
        preprocessProgress: sessionState.preprocessProgress,
        wordbookEntries: getVisibleWordbookEntries(editor)
      });

      if (showNotifications) {
        await vscode.window.showWarningMessage(
          `Read Code In Chinese: preprocessing failed. ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } finally {
      sourceEditorSession.finishTask("preprocess", task.version);
    }
  }

  function getPreferredSourceEditor(
    editor?: vscode.TextEditor
  ): vscode.TextEditor | undefined {
    return sourceEditorSession.getPreferredEditor(editor, vscode.window.activeTextEditor);
  }

  function recordSelectionFocus(
    editor: vscode.TextEditor,
    selection: vscode.Selection
  ): void {
    if (selection.isEmpty) {
      return;
    }

    const relativeFilePath = getRelativeFilePath(editor);

    if (!relativeFilePath) {
      return;
    }

    const midpointLine = Math.floor((selection.start.line + selection.end.line) / 2) + 1;
    sourceEditorSession.recordSelectionLine(relativeFilePath, midpointLine);
  }
}

export function deactivate(): void {}

function createTokenKnowledgeIdentity(
  request: ExplanationRequest
): TokenKnowledgeIdentity {
  const insight = request.selectionInsight;
  const origin = insight?.origin ?? "unknown";
  const needsCallsiteIsolation = origin === "local" || origin === "unknown";

  return {
    term: insight?.term ?? request.selectedText,
    ...(insight?.qualifiedName ? { qualifiedName: insight.qualifiedName } : {}),
    origin,
    ...(needsCallsiteIsolation
      ? {
          contextHash: createContentHash(
            [
              request.relativeFilePath,
              request.selectionPreview,
              request.contextBefore,
              request.contextAfter
            ].join("\n")
          )
        }
      : {})
  };
}

function createWorkspaceAwareProvider(
  settings: ReturnType<typeof getSettings>,
  logger: ExtensionLogger
): ExplanationProvider {
  if (
    settings.providerId === "openai-compatible" &&
    settings.providerRequireTrustedWorkspace &&
    !vscode.workspace.isTrusted
  ) {
    logger.warn("Remote provider disabled for untrusted workspace", {
      providerId: settings.providerId
    });
    return createProvider(
      {
        ...settings,
        providerId: "local",
        providerBaseUrl: "",
        providerModel: ""
      },
      logger
    );
  }

  return createProvider(settings, logger);
}

async function runExplanationWithFallback(
  provider: ExplanationProvider,
  request: ExplanationRequest,
  logger: ExtensionLogger,
  signal?: AbortSignal
): Promise<ExplanationResponse> {
  try {
    return attachSelectionDocumentation(
      await provider.explain(request, { signal }),
      request
    );
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw error;
    }

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
    const response = await fallbackProvider.explain(request, { signal });

    return attachSelectionDocumentation(
      {
        ...response,
        note: `Fell back to the local engine because the configured provider failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      },
      request
    );
  }
}

async function runFollowUpWithFallback(
  provider: ExplanationProvider,
  request: Parameters<ExplanationProvider["answerFollowUp"]>[0],
  logger: ExtensionLogger,
  signal?: AbortSignal
) {
  try {
    return await provider.answerFollowUp(request, { signal });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw error;
    }

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

    return fallbackProvider.answerFollowUp(request, { signal });
  }
}

async function runPromptProfileWithFallback(
  provider: ExplanationProvider,
  request: PromptProfileRequest,
  logger: ExtensionLogger,
  signal?: AbortSignal
): Promise<PromptProfileResponse> {
  try {
    if (!provider.generatePromptProfile) {
      throw new Error("Configured provider does not support prompt generation.");
    }

    return await provider.generatePromptProfile(request, { signal });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw error;
    }

    logger.error("Primary prompt generator failed, using local fallback", error);
    const fallbackProvider = createProvider(
      {
        ...getSettings(),
        providerId: "local",
        providerBaseUrl: "",
        providerModel: ""
      },
      logger
    );

    if (!fallbackProvider.generatePromptProfile) {
      throw new Error("Local fallback provider does not support prompt generation.");
    }

    const response = await fallbackProvider.generatePromptProfile(request, { signal });

    return {
      ...response,
      note: `Fell back to the local prompt generator because the configured provider failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
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
  relativeFilePath: string,
  selectionOverride?: vscode.Selection
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
      : selectionOverride ?? editor.selection;
  const contextPadding =
    settings.detailLevel === "deep"
      ? 8
      : settings.detailLevel === "fast"
        ? 2
        : 4;
  const contextBeforeStart = Math.max(0, selection.start.line - contextPadding);
  const contextAfterEnd = Math.min(editor.document.lineCount - 1, selection.end.line + contextPadding);
  const startLineText = editor.document.lineAt(selection.start.line).text;
  const endLineText = editor.document.lineAt(selection.end.line).text;
  const selectionPreview =
    selection.start.line === selection.end.line
      ? `${startLineText.slice(0, selection.start.character)}[[${selectedText}]]${startLineText.slice(selection.end.character)}`
      : `${startLineText.slice(0, selection.start.character)}[[${selectedText}]]${endLineText.slice(selection.end.character)}`;
  const contextBefore = editor.document
    .getText(
      new vscode.Range(contextBeforeStart, 0, selection.start.line, selection.start.character)
    )
    .trim();
  const contextAfter = editor.document
    .getText(
      new vscode.Range(
        selection.end.line,
        selection.end.character,
        contextAfterEnd,
        editor.document.lineAt(contextAfterEnd).text.length
      )
    )
    .trim();
  const selectionInsight =
    reason === "fileOverview" || reason === "workspaceIndex"
      ? undefined
      : await inspectEditorSelection(
          editor,
          selection,
          selectedText,
          selectionPreview,
          granularity,
          glossaryEntries
        );
  const knowledgeSnippets = await knowledgeStore.search(
    [
      editor.document.languageId,
      selectedText,
      selectionInsight?.qualifiedName,
      selectionInsight?.signature,
      contextBefore,
      contextAfter
    ]
      .filter(Boolean)
      .join("\n"),
    settings.knowledgeTopK
  );

  return {
    requestId: createContentHash(
      [
        editor.document.uri.fsPath,
        reason,
        granularity,
        selectedText,
        selectionInsight?.kind,
        selectionInsight?.qualifiedName,
        settings.detailLevel,
        settings.professionalLevel
      ].join(":")
    ),
    reason,
    languageId: editor.document.languageId,
    filePath: editor.document.uri.fsPath,
    relativeFilePath,
    selectedText,
    selectionPreview,
    granularity,
    detailLevel: settings.detailLevel,
    occupation: settings.occupation,
    professionalLevel: settings.professionalLevel,
    sections: settings.sections,
    userGoal: settings.userGoal,
    customInstructions:
      settings.customInstructions ||
      generateGlobalPrompt({
        occupation: settings.occupation,
        professionalLevel: settings.professionalLevel,
        detailLevel: settings.detailLevel,
        sections: settings.sections,
        reasoningEffort: settings.providerReasoningEffort,
        temperature: settings.providerTemperature,
        topP: settings.providerTopP,
        maxTokens: settings.providerMaxTokens,
        userGoal: settings.userGoal
      }),
    contextBefore,
    contextAfter,
    selectionInsight,
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

function summarizeSettings(settings: ReturnType<typeof getSettings>) {
  return {
    providerId: settings.providerId,
    providerBaseUrl: settings.providerBaseUrl || "(empty)",
    providerModel: settings.providerModel || "(empty)",
    providerApiKeyEnvVar: settings.providerApiKeyEnvVar,
    hasApiKey: Boolean(process.env[settings.providerApiKeyEnvVar]),
    providerFallbackCount: settings.providerFallbacks.length,
    providerFallbacks: settings.providerFallbacks.map((endpoint) => ({
      baseUrl: endpoint.baseUrl,
      apiKeyEnvVar: endpoint.apiKeyEnvVar,
      hasApiKey: Boolean(process.env[endpoint.apiKeyEnvVar]),
      model: endpoint.model || settings.providerModel || "(empty)"
    })),
    providerReasoningEffort: settings.providerReasoningEffort,
    providerRequireTrustedWorkspace: settings.providerRequireTrustedWorkspace,
    detailLevel: settings.detailLevel,
    professionalLevel: settings.professionalLevel,
    occupation: settings.occupation,
    sections: settings.sections,
    autoExplainEnabled: settings.autoExplainEnabled,
    autoOpenPanel: settings.autoOpenPanel,
    preprocessMode: settings.preprocessMode,
    preprocessMaxFileBytes: settings.preprocessMaxFileBytes,
    preprocessMaxCandidates: settings.preprocessMaxCandidates,
    preprocessExcludeCount: settings.preprocessExclude.length
  };
}

function inferCurrentGranularity(
  editor: vscode.TextEditor | undefined
): ExplanationGranularity | undefined {
  if (!editor || editor.selection.isEmpty) {
    return undefined;
  }

  const selectedText = editor.document.getText(editor.selection).trim();

  if (!selectedText) {
    return undefined;
  }

  return inferGranularity(
    selectedText,
    editor.selection.end.line - editor.selection.start.line + 1
  );
}

function getRelativeFilePath(editor: vscode.TextEditor | undefined): string | undefined {
  return editor ? getProjectContext(editor.document)?.relativeFilePath : undefined;
}

function getVisiblePreprocessProgress(
  progress: PreprocessProgress | undefined,
  editor: vscode.TextEditor | undefined
): PreprocessProgress | undefined {
  if (!progress || !editor) {
    return undefined;
  }

  return progress.relativeFilePath === getRelativeFilePath(editor) ? progress : undefined;
}

async function persistConfigurationValue(key: string, value: unknown): Promise<void> {
  const configuration = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  await configuration.update(key, value, vscode.ConfigurationTarget.Global);

  if (vscode.workspace.workspaceFolders?.length) {
    await configuration.update(key, value, vscode.ConfigurationTarget.Workspace);
  }
}

async function saveSettingsFromPanel(payload: {
  providerId: ReturnType<typeof getSettings>["providerId"];
  providerBaseUrl: string;
  providerModel: string;
  providerApiKeyEnvVar: string;
  providerFallbacks: ReturnType<typeof getSettings>["providerFallbacks"];
  providerTimeoutMs: number;
  providerRequireTrustedWorkspace: boolean;
  customInstructions: string;
  userGoal: string;
  detailLevel: ReturnType<typeof getSettings>["detailLevel"];
  professionalLevel: ReturnType<typeof getSettings>["professionalLevel"];
  occupation: ReturnType<typeof getSettings>["occupation"];
  sections: string[];
  temperature: number;
  topP: number;
  maxTokens: number;
  reasoningEffort: ReturnType<typeof getSettings>["providerReasoningEffort"];
  autoExplainEnabled: boolean;
  preprocessMode: ReturnType<typeof getSettings>["preprocessMode"];
  preprocessExclude: string[];
  preprocessMaxFileBytes: number;
  preprocessMaxCandidates: number;
}): Promise<void> {
  const currentSettings = getSettings();
  const sanitizedProviderTimeoutMs = sanitizeNumber(
    payload.providerTimeoutMs,
    currentSettings.providerTimeoutMs,
    { minimum: 1000 }
  );
  const sanitizedTemperature = sanitizeNumber(payload.temperature, currentSettings.providerTemperature, {
    minimum: 0,
    maximum: 2
  });
  const sanitizedTopP = sanitizeNumber(payload.topP, currentSettings.providerTopP, {
    minimum: 0,
    maximum: 1
  });
  const sanitizedMaxTokens = Math.round(
    sanitizeNumber(payload.maxTokens, currentSettings.providerMaxTokens, {
      minimum: 64
    })
  );
  const sanitizedPreprocessMaxFileBytes = Math.round(
    sanitizeNumber(payload.preprocessMaxFileBytes, currentSettings.preprocessMaxFileBytes, {
      minimum: 1024
    })
  );
  const sanitizedPreprocessMaxCandidates = Math.round(
    sanitizeNumber(payload.preprocessMaxCandidates, currentSettings.preprocessMaxCandidates, {
      minimum: 1,
      maximum: 1000
    })
  );
  const sanitizedPreprocessMode = ["off", "manual", "onSave", "idle"].includes(
    payload.preprocessMode
  )
    ? payload.preprocessMode
    : currentSettings.preprocessMode;
  const updates: Array<[string, unknown]> = [
    ["provider.id", payload.providerId],
    ["provider.baseUrl", payload.providerBaseUrl.trim()],
    ["provider.model", payload.providerModel.trim()],
    ["provider.apiKeyEnvVar", payload.providerApiKeyEnvVar.trim()],
    ["provider.fallbacks", sanitizeProviderFallbacks(payload.providerFallbacks)],
    ["provider.timeoutMs", sanitizedProviderTimeoutMs],
    ["prompt.customInstructions", payload.customInstructions.trim()],
    ["explanation.userGoal", payload.userGoal.trim()],
    ["explanation.detailLevel", payload.detailLevel],
    ["explanation.professionalLevel", payload.professionalLevel],
    ["explanation.occupation", payload.occupation],
    ["explanation.sections", payload.sections.length ? payload.sections : ["summary"]],
    ["provider.temperature", sanitizedTemperature],
    ["provider.topP", sanitizedTopP],
    ["provider.maxTokens", sanitizedMaxTokens],
    ["provider.reasoningEffort", payload.reasoningEffort],
    ["provider.requireTrustedWorkspace", payload.providerRequireTrustedWorkspace],
    ["autoExplain.enabled", payload.autoExplainEnabled],
    ["preprocess.mode", sanitizedPreprocessMode],
    ["preprocess.exclude", sanitizeStringList(payload.preprocessExclude)],
    ["preprocess.maxFileBytes", sanitizedPreprocessMaxFileBytes],
    ["preprocess.maxCandidates", sanitizedPreprocessMaxCandidates]
  ];

  for (const [key, value] of updates) {
    await persistConfigurationValue(key, value);
  }

  const savedSettings = getSettings();

  await vscode.window.showInformationMessage(
    `Read Code In Chinese: 设置已保存。服务=${savedSettings.providerId}，预处理=${savedSettings.preprocessMode}。`
  );
}

function sanitizeNumber(
  value: number,
  fallback: number,
  options?: { minimum?: number; maximum?: number }
): number {
  const safeValue = Number.isFinite(value) ? value : fallback;
  const minimum = options?.minimum ?? -Infinity;
  const maximum = options?.maximum ?? Infinity;

  return Math.min(maximum, Math.max(minimum, safeValue));
}

function sanitizeProviderFallbacks(
  fallbacks: ReturnType<typeof getSettings>["providerFallbacks"]
): ReturnType<typeof getSettings>["providerFallbacks"] {
  const uniqueFallbacks = new Set<string>();
  const normalizedFallbacks: ReturnType<typeof getSettings>["providerFallbacks"] = [];

  for (const fallback of fallbacks) {
    const baseUrl = fallback.baseUrl.trim();
    const apiKeyEnvVar = fallback.apiKeyEnvVar.trim();
    const model = fallback.model?.trim();

    if (!baseUrl || !apiKeyEnvVar) {
      continue;
    }

    const uniqueKey = `${baseUrl}|${apiKeyEnvVar}|${model ?? ""}`;

    if (uniqueFallbacks.has(uniqueKey)) {
      continue;
    }

    uniqueFallbacks.add(uniqueKey);
    normalizedFallbacks.push({
      baseUrl,
      apiKeyEnvVar,
      ...(model ? { model } : {})
    });
  }

  return normalizedFallbacks;
}

function sanitizeStringList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isAbortLikeError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error) {
    return error.name === "AbortError" || /aborted/i.test(error.message);
  }

  return false;
}
