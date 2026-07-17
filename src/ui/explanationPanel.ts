import * as vscode from "vscode";
import {
  ChatTurn,
  ExplanationGranularity,
  ExplanationResponse,
  GlossaryEntry,
  PreprocessedSymbolEntry,
  PreprocessProgress,
  ReasoningEffort,
  SelectionInsight,
  WorkspaceIndex
} from "../contracts";

export interface ExplanationPanelState {
  explanation?: ExplanationResponse;
  chatHistory: ChatTurn[];
  workspaceIndex?: WorkspaceIndex;
  glossaryEntries: GlossaryEntry[];
  wordbookEntries: PreprocessedSymbolEntry[];
  statusMessage?: string;
  isWatchingSelection?: boolean;
  currentFile?: string;
  currentSelectionLabel?: string;
  hasSelection?: boolean;
  currentGranularity?: ExplanationGranularity;
  currentSelectionInsight?: SelectionInsight;
  isLoading?: boolean;
  reasoningEffort?: ReasoningEffort;
  lastUpdatedAt?: string;
  preprocessProgress?: PreprocessProgress;
}

type PanelMessage =
  | { type: "ready" }
  | { type: "explainCurrentSelection" }
  | { type: "askQuestion"; question: string }
  | { type: "openSettings" }
  | { type: "toggleSelectionWatch"; enabled: boolean }
  | { type: "setReasoningEffort"; reasoningEffort: ReasoningEffort };

export class ExplanationPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private watchingSelection = true;
  private state: ExplanationPanelState = {
    chatHistory: [],
    glossaryEntries: [],
    wordbookEntries: []
  };

  constructor(
    private readonly onMessage: (message: PanelMessage) => Promise<void>
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      this.postState();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "readCodeInChinese.explanationPanel",
      "Read Code In Chinese",
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.panel.onDidChangeViewState(() => {
      this.postState();
    });
    this.panel.webview.onDidReceiveMessage(async (message: PanelMessage) => {
      try {
        await this.onMessage(message);
      } catch (error) {
        this.setState({
          isLoading: false,
          statusMessage: `面板操作失败：${
            error instanceof Error ? error.message : String(error)
          }`
        });
      }
    });

    this.postState();
  }

  isWatchingSelection(): boolean {
    return Boolean(this.panel && this.watchingSelection);
  }

  setWatchingSelection(enabled: boolean): void {
    this.watchingSelection = enabled;
    this.postState();
  }

  isVisible(): boolean {
    return Boolean(this.panel?.visible);
  }

  isOpen(): boolean {
    return Boolean(this.panel);
  }

  setState(state: Partial<ExplanationPanelState>): void {
    this.state = {
      ...this.state,
      ...state
    };
    this.postState();
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private postState(): void {
    if (!this.panel) {
      return;
    }

    void this.panel.webview.postMessage({
      type: "render",
      payload: {
        ...this.state,
        isWatchingSelection: this.isWatchingSelection()
      }
    });
  }

  private getHtml(): string {
    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Read Code In Chinese</title>
    <style>
      :root {
        color-scheme: light dark;
      }

      body {
        margin: 0;
        padding: clamp(10px, 2vw, 18px);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        font: 13px/1.55 var(--vscode-font-family);
        box-sizing: border-box;
      }

      * {
        box-sizing: border-box;
      }

      .layout {
        display: grid;
        gap: 12px;
        width: min(100%, 920px);
        margin: 0 auto;
      }

      .card {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        background: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-editorWidget-background) 8%);
        overflow: hidden;
        box-shadow: 0 8px 24px color-mix(in srgb, var(--vscode-widget-shadow) 16%, transparent);
      }

      .card-body {
        padding: 14px;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .tabs {
        display: inline-flex;
        gap: 8px;
        margin-top: 12px;
      }

      .tab {
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 999px;
        padding: 6px 12px;
        background: transparent;
        color: var(--vscode-foreground);
        cursor: pointer;
      }

      .tab.active {
        background: color-mix(in srgb, var(--vscode-textLink-foreground) 16%, transparent);
        color: var(--vscode-textLink-foreground);
      }

      .title {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      .subtitle {
        margin-top: 2px;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 9px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--vscode-textLink-foreground) 14%, transparent);
        color: var(--vscode-textLink-foreground);
        font-size: 11px;
      }

      .spinner {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 2px solid color-mix(in srgb, var(--vscode-textLink-foreground) 18%, transparent);
        border-top-color: var(--vscode-textLink-foreground);
        animation: spin 0.7s linear infinite;
        display: none;
      }

      .spinner.loading {
        display: inline-block;
      }

      .meta {
        display: grid;
        gap: 4px;
        margin-top: 10px;
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }

      .summary {
        font-size: 13px;
        white-space: pre-wrap;
      }

      .summary-hero {
        display: grid;
        gap: 10px;
        padding: 14px;
        border-left: 3px solid var(--vscode-textLink-foreground);
        border-radius: 8px;
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, transparent);
      }

      .summary-hero .summary {
        font-size: 14px;
        line-height: 1.65;
      }

      .label {
        margin-bottom: 6px;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .stack {
        display: grid;
        gap: 12px;
      }

      .page {
        display: none;
      }

      .page.active {
        display: grid;
        gap: 12px;
      }

      .section {
        padding: 12px;
        border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 82%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-editorWidget-background) 12%);
      }

      .section:first-child {
        padding: 12px;
        border-top: 1px solid color-mix(in srgb, var(--vscode-panel-border) 82%, transparent);
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 999px;
        padding: 6px 10px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        cursor: pointer;
      }

      .chip.static {
        cursor: default;
        padding: 3px 8px;
        font-size: 11px;
      }

      .icon-button {
        width: 30px;
        height: 30px;
        display: inline-grid;
        place-items: center;
        border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
        border-radius: 7px;
        background: transparent;
        color: var(--vscode-foreground);
        cursor: pointer;
        max-width: 100%;
        overflow-wrap: anywhere;
        font-size: 15px;
      }

      .icon-button:hover,
      .tab:hover {
        background: var(--vscode-toolbar-hoverBackground);
      }

      .watch-button {
        min-height: 30px;
        border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
        border-radius: 7px;
        padding: 4px 9px;
        background: transparent;
        color: var(--vscode-foreground);
        cursor: pointer;
      }

      .watch-button.active {
        border-color: color-mix(in srgb, var(--vscode-textLink-foreground) 65%, var(--vscode-panel-border));
        color: var(--vscode-textLink-foreground);
        background: color-mix(in srgb, var(--vscode-textLink-foreground) 10%, transparent);
      }

      .chip:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }

      .list {
        display: grid;
        gap: 8px;
      }

      .list-item {
        padding: 10px 12px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, transparent);
      }

      .list-item-title {
        font-weight: 600;
        margin-bottom: 4px;
      }

      .list-item-meta {
        margin-top: 4px;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
      }

      .wordbook-tree {
        display: grid;
        gap: 4px;
      }

      .tree-group,
      .tree-term {
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, transparent);
      }

      .tree-group > summary,
      .tree-term > summary {
        cursor: pointer;
        padding: 4px 8px;
      }

      .tree-group > summary {
        font-weight: 600;
      }

      .tree-term > summary {
        font-weight: 500;
      }

      .tree-label {
        font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
        font-size: 12px;
      }

      .tree-children {
        display: grid;
        gap: 4px;
        margin: 0 0 6px 10px;
        padding-left: 10px;
        border-left: 1px solid color-mix(in srgb, var(--vscode-panel-border) 72%, transparent);
      }

      .tree-term-body {
        display: grid;
        gap: 4px;
        padding: 0 10px 10px 24px;
      }

      .tree-term-meta {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
      }

      .tree-term-summary {
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .muted {
        color: var(--vscode-descriptionForeground);
      }

      .glossary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .glossary-item {
        padding: 6px 10px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--vscode-inputOption-activeBackground) 55%, transparent);
        border: 1px solid color-mix(in srgb, var(--vscode-inputOption-activeBorder) 55%, transparent);
      }

      .bullet-list {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 4px;
      }

      .bullet-list li {
        line-height: 1.5;
      }

      .progress-wrap {
        display: grid;
        gap: 8px;
      }

      .progress-bar {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        overflow: hidden;
        background: color-mix(in srgb, var(--vscode-input-background) 88%, transparent);
      }

      .progress-fill {
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, var(--vscode-textLink-foreground), color-mix(in srgb, var(--vscode-textLink-foreground) 65%, white));
        transition: width 0.15s ease;
      }

      textarea {
        width: 100%;
        min-height: 92px;
        resize: vertical;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--vscode-input-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font: inherit;
      }

      .actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
        gap: 10px;
      }

      .chat-controls {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .chat-controls select {
        min-width: 110px;
        width: auto;
      }

      .primary {
        border: 0;
        border-radius: 8px;
        padding: 8px 12px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        cursor: pointer;
      }

      .primary:hover {
        background: var(--vscode-button-hoverBackground);
      }

      button:disabled,
      textarea:disabled,
      select:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .compact-details {
        border-top: 1px solid var(--vscode-panel-border);
        padding-top: 10px;
      }

      .compact-details > summary {
        cursor: pointer;
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }

      .compact-details[hidden] {
        display: none;
      }

      .error-banner {
        display: none;
        padding: 8px 10px;
        border-radius: 7px;
        color: var(--vscode-errorForeground);
        background: color-mix(in srgb, var(--vscode-inputValidation-errorBackground) 76%, transparent);
        border: 1px solid var(--vscode-inputValidation-errorBorder);
      }

      .error-banner.visible {
        display: block;
      }

      @media (max-width: 520px) {
        .header {
          align-items: flex-start;
          flex-direction: column;
        }

        .actions {
          align-items: stretch;
          flex-direction: column;
        }

        .chat-controls {
          justify-content: space-between;
        }

        .primary {
          width: 100%;
        }
      }

      .empty {
        color: var(--vscode-descriptionForeground);
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <section class="card">
        <div class="card-body">
          <div class="header">
            <div>
              <div class="title">中文读代码</div>
              <div class="subtitle">跟随选区，快速理解变量、函数与库 API</div>
            </div>
            <div class="header-actions">
              <div id="loadingSpinner" class="spinner"></div>
              <button class="icon-button" id="explainButton" type="button" title="重新解释当前选区" aria-label="重新解释当前选区">↻</button>
              <button class="watch-button active" id="watchToggleButton" type="button" title="暂停或恢复自动跟随选区">◉ 跟随选区</button>
              <button class="icon-button" id="settingsButton" type="button" title="打开设置" aria-label="打开设置">⚙</button>
            </div>
          </div>
          <div class="tabs" role="tablist" aria-label="内容页面">
            <button class="tab active" id="explainTabButton" type="button" role="tab" aria-selected="true">解释</button>
            <button class="tab" id="wordbookTabButton" type="button" role="tab" aria-selected="false">文件词典</button>
          </div>
          <div id="meta" class="meta" aria-live="polite"></div>
          <div id="errorBanner" class="error-banner" role="alert"></div>
        </div>
      </section>

      <section class="card">
        <div class="card-body stack">
          <div id="explainPage" class="page active">
            <div class="summary-hero">
              <div id="symbolBadges" class="chips"></div>
              <div id="engineInfo" class="meta"></div>
              <div id="summary" class="summary empty" aria-live="polite">在编辑器中选择代码，即可查看精简中文解释。</div>
            </div>
            <details class="compact-details" id="preprocessSection">
              <summary>文件预处理状态</summary>
              <div class="progress-wrap">
                <div id="preprocessMeta" class="meta"></div>
                <div class="progress-bar"><div id="preprocessFill" class="progress-fill"></div></div>
              </div>
            </details>
            <div>
              <div class="label">核心信息</div>
              <div id="sections" class="stack"></div>
            </div>
            <details class="compact-details" id="glossarySection">
              <summary>当前文件术语</summary>
              <div id="glossary" class="glossary"></div>
            </details>
            <details class="compact-details" id="workspaceSection">
              <summary>工作区索引预览</summary>
              <div id="workspaceIndex" class="list"></div>
            </details>
          </div>

          <div id="wordbookPage" class="page">
            <div>
                <div class="label">预处理进度</div>
              <div class="progress-wrap">
                <div id="wordbookPreprocessMeta" class="meta"></div>
                <div class="progress-bar"><div id="wordbookPreprocessFill" class="progress-fill"></div></div>
              </div>
            </div>
            <div>
              <div class="label">当前文件词典</div>
              <div id="wordbook" class="list"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-body">
          <div class="label">继续追问</div>
          <div id="chatHistory" class="list"></div>
          <textarea id="questionInput" placeholder="针对当前解释继续提问，Ctrl/Cmd + Enter 发送"></textarea>
          <div class="actions">
            <div class="chat-controls">
              <span class="muted">推理强度</span>
              <select id="reasoningEffortSelect">
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="xhigh">极高</option>
              </select>
            </div>
            <button class="primary" id="sendButton" disabled>发送</button>
          </div>
        </div>
      </section>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();

      const persistedState = vscode.getState() || {};
      const watchToggleButton = document.getElementById("watchToggleButton");
      const loadingSpinner = document.getElementById("loadingSpinner");
      const explainButton = document.getElementById("explainButton");
      const settingsButton = document.getElementById("settingsButton");
      const explainTabButton = document.getElementById("explainTabButton");
      const wordbookTabButton = document.getElementById("wordbookTabButton");
      const explainPage = document.getElementById("explainPage");
      const wordbookPage = document.getElementById("wordbookPage");
      const meta = document.getElementById("meta");
      const errorBanner = document.getElementById("errorBanner");
      const summary = document.getElementById("summary");
      const engineInfo = document.getElementById("engineInfo");
      const symbolBadges = document.getElementById("symbolBadges");
      const preprocessSection = document.getElementById("preprocessSection");
      const preprocessMeta = document.getElementById("preprocessMeta");
      const preprocessFill = document.getElementById("preprocessFill");
      const wordbookPreprocessMeta = document.getElementById("wordbookPreprocessMeta");
      const wordbookPreprocessFill = document.getElementById("wordbookPreprocessFill");
      const wordbook = document.getElementById("wordbook");
      const sections = document.getElementById("sections");
      const glossary = document.getElementById("glossary");
      const glossarySection = document.getElementById("glossarySection");
      const workspaceIndex = document.getElementById("workspaceIndex");
      const workspaceSection = document.getElementById("workspaceSection");
      const chatHistory = document.getElementById("chatHistory");
      const questionInput = document.getElementById("questionInput");
      const reasoningEffortSelect = document.getElementById("reasoningEffortSelect");
      const sendButton = document.getElementById("sendButton");
      let activePage = persistedState.activePage === "wordbook" ? "wordbook" : "explain";

      function setActivePage(nextPage) {
        if (nextPage !== "explain" && nextPage !== "wordbook") {
          return;
        }

        activePage = nextPage;
        explainTabButton.className = nextPage === "explain" ? "tab active" : "tab";
        wordbookTabButton.className = nextPage === "wordbook" ? "tab active" : "tab";
        explainTabButton.setAttribute("aria-selected", String(nextPage === "explain"));
        wordbookTabButton.setAttribute("aria-selected", String(nextPage === "wordbook"));
        explainPage.className = nextPage === "explain" ? "page active" : "page";
        wordbookPage.className = nextPage === "wordbook" ? "page active" : "page";
        vscode.setState({ ...persistedState, activePage: nextPage });
      }

      function renderBulletList(items) {
        const list = document.createElement("ul");
        list.className = "bullet-list";
        for (const item of items) {
          const li = document.createElement("li");
          li.textContent = item;
          list.appendChild(li);
        }
        return list;
      }

      function renderSection(section) {
        const wrapper = document.createElement("div");
        wrapper.className = "section";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = localizeSectionLabel(section.label);

        wrapper.appendChild(label);
        if (section.items && section.items.length) {
          wrapper.appendChild(renderBulletList(section.items));
        }
        if (section.content && !(section.items && section.items.length)) {
          const content = document.createElement("div");
          content.className = "summary";
          content.textContent = section.content;
          wrapper.appendChild(content);
        }
        return wrapper;
      }

      function renderListItem(titleText, bodyText, metaText) {
        const wrapper = document.createElement("div");
        wrapper.className = "list-item";

        if (titleText) {
          const title = document.createElement("div");
          title.className = "list-item-title";
          title.textContent = titleText;
          wrapper.appendChild(title);
        }

        const body = document.createElement("div");
        body.textContent = bodyText;
        wrapper.appendChild(body);
        if (metaText) {
          const meta = document.createElement("div");
          meta.className = "list-item-meta";
          meta.textContent = metaText;
          wrapper.appendChild(meta);
        }
        return wrapper;
      }

      function renderGlossaryItem(entry) {
        const wrapper = document.createElement("div");
        wrapper.className = "glossary-item";
        wrapper.textContent = entry.term + " = " + entry.meaning;
        return wrapper;
      }

      function askQuestion(question) {
        const value = question.trim();
        if (!value || sendButton.disabled) {
          return false;
        }

        sendButton.disabled = true;
        questionInput.disabled = true;
        reasoningEffortSelect.disabled = true;
        vscode.postMessage({
          type: "askQuestion",
          question: value
        });
        return true;
      }

      function renderEmpty(container, message) {
        container.replaceChildren();
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = message;
        container.appendChild(empty);
      }

      function renderTextLines(container, lines) {
        container.replaceChildren();
        for (const line of lines) {
          const item = document.createElement("div");
          item.textContent = line;
          container.appendChild(item);
        }
      }

      function renderSymbolBadges(granularity, insight) {
        symbolBadges.replaceChildren();
        const values = [];

        if (insight?.kind) {
          values.push(localizeSymbolKind(insight.kind));
        } else if (granularity) {
          values.push(localizeGranularity(granularity));
        }

        if (insight?.origin && insight.origin !== "unknown") {
          values.push(localizeOrigin(insight.origin));
        }

        if (insight?.qualifiedName) {
          values.push(insight.qualifiedName);
        }

        for (const value of values) {
          const chip = document.createElement("div");
          chip.className = "chip static";
          chip.textContent = value;
          symbolBadges.appendChild(chip);
        }
      }

      function localizeSectionLabel(value) {
        const labels = {
          summary: "概要",
          inputOutput: "输入与输出",
          usage: "当前用途",
          syntax: "语法结构",
          risk: "注意事项"
        };
        return labels[value] || value;
      }

      function localizeSymbolKind(value) {
        const labels = {
          variable: "变量",
          function: "函数 / 方法",
          class: "类",
          type: "类型",
          module: "模块",
          constant: "常量",
          label: "标签",
          unknown: "代码符号"
        };
        return labels[value] || value;
      }

      function localizeGranularity(value) {
        const labels = {
          token: "单个符号",
          statement: "语句",
          block: "代码块",
          function: "函数",
          file: "文件",
          workspace: "工作区"
        };
        return labels[value] || value;
      }

      function localizeOrigin(value) {
        const labels = {
          local: "项目内",
          library: "库 / 包",
          builtin: "语言内置"
        };
        return labels[value] || value;
      }

      function showRenderError(error) {
        errorBanner.textContent = "界面更新失败：" + (error instanceof Error ? error.message : String(error));
        errorBanner.className = "error-banner visible";
      }

      function buildWordbookTree(entries) {
        const root = {
          groups: [],
          terms: [],
          groupMap: new Map()
        };
        const sortedEntries = [...entries].sort((left, right) => {
          return (
            (left.sourceLine || Number.MAX_SAFE_INTEGER) -
              (right.sourceLine || Number.MAX_SAFE_INTEGER) ||
            left.term.localeCompare(right.term)
          );
        });

        for (const entry of sortedEntries) {
          const path =
            Array.isArray(entry.scopePath) && entry.scopePath.length
              ? entry.scopePath
              : ["模块作用域"];
          let current = root;

          for (const segment of path) {
            let group = current.groupMap.get(segment);

            if (!group) {
              group = {
                label: segment,
                groups: [],
                terms: [],
                groupMap: new Map()
              };
              current.groupMap.set(segment, group);
              current.groups.push(group);
            }

            current = group;
          }

          current.terms.push(entry);
        }

        return root;
      }

      function renderWordbookEntry(entry) {
        const details = document.createElement("details");
        details.className = "tree-term";

        const summary = document.createElement("summary");
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = entry.term;
        summary.appendChild(label);
        details.appendChild(summary);

        const body = document.createElement("div");
        body.className = "tree-term-body";

        const meta = document.createElement("div");
        meta.className = "tree-term-meta";
        meta.textContent = localizeSymbolKind(entry.category) + " | 第 " + entry.sourceLine + " 行";
        body.appendChild(meta);

        const description = document.createElement("div");
        description.className = "tree-term-summary";
        description.textContent = entry.summary;
        body.appendChild(description);

        details.appendChild(body);
        return details;
      }

      function renderWordbookGroup(group) {
        const details = document.createElement("details");
        details.className = "tree-group";

        const summary = document.createElement("summary");
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = group.label;
        summary.appendChild(label);
        details.appendChild(summary);

        const children = document.createElement("div");
        children.className = "tree-children";

        for (const childGroup of group.groups) {
          children.appendChild(renderWordbookGroup(childGroup));
        }

        for (const entry of group.terms) {
          children.appendChild(renderWordbookEntry(entry));
        }

        details.appendChild(children);
        return details;
      }

      function renderWordbook(entries) {
        wordbook.replaceChildren();

        if (!entries.length) {
          renderEmpty(wordbook, "运行文件预处理后，这里会显示按作用域整理的词典。");
          return;
        }

        const tree = buildWordbookTree(entries);
        const container = document.createElement("div");
        container.className = "wordbook-tree";

        for (const group of tree.groups) {
          container.appendChild(renderWordbookGroup(group));
        }

        wordbook.appendChild(container);
      }

      function renderPreprocess(progress) {
        const lines = [];
        let percentage = 0;

        if (progress) {
          const candidatePoolCount = progress.candidatePoolCount || progress.totalCandidates;
          const selectingStep = (progress.currentStep || "").toLowerCase().includes("select");
          const preparingStep = (progress.currentStep || "").toLowerCase().includes("prepar");

          if (selectingStep) {
            lines.push("候选符号：" + candidatePoolCount);
            lines.push("计划处理：" + progress.totalCandidates);
          } else {
            lines.push("已缓存：" + progress.processedCandidates + " / " + progress.totalCandidates);
            if (candidatePoolCount !== progress.totalCandidates) {
              lines.push("候选总数：" + candidatePoolCount);
            }
          }

          if (!selectingStep && !preparingStep && progress.batchCount > 0) {
            lines.push(
              "批次：" +
                (progress.processedBatches || 0) +
                " / " +
                progress.batchCount
            );
          }
          if (progress.currentStep) {
            lines.push("阶段：" + progress.currentStep);
          }
          if (progress.message) {
            lines.push(progress.message);
          }

          if (progress.totalSteps > 0) {
            percentage = Math.max(0, Math.min(100, Math.round((progress.completedSteps / progress.totalSteps) * 100)));
          }

          if (progress.status === "running" && percentage === 0) {
            percentage = 20;
          }
        } else {
          lines.push("当前文件尚未开始预处理。" );
        }

        renderTextLines(preprocessMeta, lines);
        renderTextLines(wordbookPreprocessMeta, lines);
        preprocessFill.style.width = percentage + "%";
        wordbookPreprocessFill.style.width = preprocessFill.style.width;
      }

      window.addEventListener("message", (event) => {
        try {
          const { type, payload } = event.data || {};

          if (type !== "render" || !payload) {
            return;
          }

          const explanation = payload.explanation;
          const isWatchingSelection = Boolean(payload.isWatchingSelection);
          watchToggleButton.dataset.enabled = String(isWatchingSelection);
          watchToggleButton.className = isWatchingSelection
            ? "watch-button active"
            : "watch-button";
          watchToggleButton.textContent = isWatchingSelection ? "◉ 跟随选区" : "▶ 恢复跟随";
          loadingSpinner.className = payload.isLoading ? "spinner loading" : "spinner";
          loadingSpinner.setAttribute("aria-label", payload.isLoading ? "正在生成解释" : "空闲");
          errorBanner.className = "error-banner";
          errorBanner.textContent = "";

          const metaLines = [
            payload.statusMessage || "就绪",
            payload.currentFile ? "文件：" + payload.currentFile : "",
            payload.currentSelectionLabel ? "选区：" + payload.currentSelectionLabel : "",
            payload.lastUpdatedAt ? "更新：" + payload.lastUpdatedAt : ""
          ].filter(Boolean);
          renderTextLines(meta, metaLines);

          summary.textContent = explanation
            ? explanation.summary
            : payload.isLoading
              ? "正在分析当前选区…"
              : "在编辑器中选择代码，即可查看精简中文解释。";
          summary.className = explanation ? "summary" : "summary empty";

          const engineLines = [
            explanation?.source ? "来源：" + explanation.source : "",
            explanation?.latencyMs !== undefined ? "耗时：" + explanation.latencyMs + " ms" : "",
            explanation?.note ? explanation.note : ""
          ].filter(Boolean);
          renderTextLines(engineInfo, engineLines);

          renderSymbolBadges(payload.currentGranularity, payload.currentSelectionInsight);
          renderPreprocess(payload.preprocessProgress);
          preprocessSection.hidden = !payload.preprocessProgress;

          renderWordbook(payload.wordbookEntries || []);

          sections.replaceChildren();
          if (explanation?.sections?.length) {
            for (const section of explanation.sections) {
              sections.appendChild(renderSection(section));
            }
          } else {
            renderEmpty(sections, payload.isLoading ? "正在整理核心信息…" : "暂无结构化解释。" );
          }

          glossary.replaceChildren();
          const glossaryEntries = payload.glossaryEntries || [];
          glossarySection.hidden = glossaryEntries.length === 0;
          for (const entry of glossaryEntries.slice(0, 6)) {
            glossary.appendChild(renderGlossaryItem(entry));
          }

          workspaceIndex.replaceChildren();
          const workspaceFiles = payload.workspaceIndex?.files || [];
          workspaceSection.hidden = workspaceFiles.length === 0;
          for (const file of workspaceFiles.slice(0, 6)) {
            workspaceIndex.appendChild(renderListItem(file.path, file.summary));
          }

          chatHistory.replaceChildren();
          if ((payload.chatHistory || []).length) {
            for (const turn of payload.chatHistory) {
              chatHistory.appendChild(
                renderListItem(turn.role === "assistant" ? "解释助手" : "你", turn.content)
              );
            }
          } else {
            renderEmpty(chatHistory, explanation ? "可以继续追问当前代码。" : "生成解释后可以继续追问。" );
          }

          if (payload.reasoningEffort) {
            reasoningEffortSelect.value = payload.reasoningEffort;
          }

          sendButton.disabled = Boolean(payload.isLoading || !explanation);
          explainButton.disabled = Boolean(payload.isLoading || !payload.hasSelection);
          questionInput.disabled = Boolean(payload.isLoading || !explanation);
          reasoningEffortSelect.disabled = Boolean(payload.isLoading);
          setActivePage(activePage);
        } catch (error) {
          showRenderError(error);
        }
      });

      sendButton.addEventListener("click", () => {
        if (askQuestion(questionInput.value)) {
          questionInput.value = "";
        }
      });

      settingsButton.addEventListener("click", () => {
        vscode.postMessage({ type: "openSettings" });
      });

      explainButton.addEventListener("click", () => {
        explainButton.disabled = true;
        vscode.postMessage({ type: "explainCurrentSelection" });
      });

      watchToggleButton.addEventListener("click", () => {
        const currentlyEnabled = watchToggleButton.dataset.enabled === "true";
        vscode.postMessage({
          type: "toggleSelectionWatch",
          enabled: !currentlyEnabled
        });
      });

      explainTabButton.addEventListener("click", () => {
        setActivePage("explain");
      });

      wordbookTabButton.addEventListener("click", () => {
        setActivePage("wordbook");
      });

      reasoningEffortSelect.addEventListener("change", () => {
        vscode.postMessage({
          type: "setReasoningEffort",
          reasoningEffort: reasoningEffortSelect.value
        });
      });

      questionInput.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          if (askQuestion(questionInput.value)) {
            questionInput.value = "";
          }
        }
      });

      setActivePage(activePage);
      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
  }
}
