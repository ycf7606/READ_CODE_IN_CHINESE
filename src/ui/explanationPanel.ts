import * as vscode from "vscode";
import {
  ChatTurn,
  ExplanationGranularity,
  ExplanationResponse,
  PreprocessedSymbolEntry,
  PreprocessProgress,
  ReasoningEffort,
  WorkspaceIndex
} from "../contracts";

export interface ExplanationPanelState {
  explanation?: ExplanationResponse;
  chatHistory: ChatTurn[];
  workspaceIndex?: WorkspaceIndex;
  wordbookEntries: PreprocessedSymbolEntry[];
  statusMessage?: string;
  isWatchingSelection?: boolean;
  currentFile?: string;
  currentSelectionLabel?: string;
  currentSelectionText?: string;
  currentGranularity?: ExplanationGranularity;
  isLoading?: boolean;
  reasoningEffort?: ReasoningEffort;
  lastUpdatedAt?: string;
  preprocessProgress?: PreprocessProgress;
  currentClassScope?: string;
  currentFunctionScope?: string;
  currentScopePath?: string[];
  currentSelectionLine?: number;
}

type PanelMessage =
  | { type: "ready" }
  | { type: "askQuestion"; question: string }
  | { type: "openSettings" }
  | { type: "setReasoningEffort"; reasoningEffort: ReasoningEffort }
  | { type: "panelScriptError"; error: string };

export class ExplanationPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private state: ExplanationPanelState = {
    chatHistory: [],
    wordbookEntries: []
  };

  constructor(
    private readonly onMessage: (message: PanelMessage) => Promise<void>
  ) {}

  show(preserveFocus = true): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, preserveFocus);
      this.postState();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "readCodeInChinese.explanationPanel",
      "Read Code In Chinese",
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        enableCommandUris: true
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
      await this.onMessage(message);
    });

    this.postState();
  }

  isWatchingSelection(): boolean {
    return this.isVisible();
  }

  isVisible(): boolean {
    return Boolean(this.panel?.visible);
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
      payload: this.state
    });
  }

  private getHtml(): string {
    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="en">
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
        padding: 16px;
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
      }

      .card {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 12px;
        background: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-editorWidget-background) 8%);
        overflow: hidden;
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
        font-size: 14px;
        font-weight: 600;
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
      }

      .selection-focus {
        display: grid;
        gap: 8px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--vscode-textLink-foreground) 28%, var(--vscode-panel-border));
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--vscode-textLink-foreground) 14%, transparent),
          color-mix(in srgb, var(--vscode-editorWidget-background) 88%, transparent)
        );
      }

      .selection-focus.empty {
        border-style: dashed;
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, transparent);
      }

      .selection-focus-text {
        font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
        font-size: 16px;
        font-weight: 600;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .selection-focus-meta {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }

      .markdown {
        display: grid;
        gap: 8px;
      }

      .markdown > :first-child {
        margin-top: 0;
      }

      .markdown > :last-child {
        margin-bottom: 0;
      }

      .markdown p,
      .markdown ul,
      .markdown ol,
      .markdown pre {
        margin: 0;
      }

      .markdown ul,
      .markdown ol {
        padding-left: 18px;
      }

      .markdown li + li {
        margin-top: 4px;
      }

      .markdown code {
        padding: 1px 6px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--vscode-textBlockQuote-background) 92%, transparent);
        font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
        font-size: 0.95em;
      }

      .markdown pre {
        padding: 10px 12px;
        border-radius: 10px;
        overflow-x: auto;
        background: color-mix(in srgb, var(--vscode-textBlockQuote-background) 92%, transparent);
      }

      .markdown pre code {
        padding: 0;
        background: transparent;
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
        padding-top: 12px;
        border-top: 1px solid var(--vscode-panel-border);
      }

      .section:first-child {
        padding-top: 0;
        border-top: 0;
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

      .chip:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }

      .chip-link {
        display: inline-flex;
        align-items: center;
        text-decoration: none;
      }

      .list {
        display: grid;
        gap: 8px;
      }

      .list-item {
        padding: 10px 12px;
        border-radius: 10px;
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
        gap: 6px;
      }

      .wordbook-toolbar {
        display: grid;
        gap: 8px;
      }

      .wordbook-toolbar-grid {
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1.8fr) minmax(150px, 1fr);
      }

      .wordbook-toolbar input,
      .wordbook-toolbar select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--vscode-input-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font: inherit;
      }

      .wordbook-stats {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }

      .tree-group,
      .tree-term {
        border-radius: 7px;
        border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, transparent);
      }

      .tree-group > summary,
      .tree-term > summary {
        cursor: pointer;
        padding: 3px 8px;
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

      .tree-label-meta {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        margin-left: 8px;
      }

      .tree-children {
        display: grid;
        gap: 4px;
        margin: 0 0 5px 10px;
        padding-left: 10px;
        border-left: 1px solid color-mix(in srgb, var(--vscode-panel-border) 72%, transparent);
      }

      .tree-term-body {
        display: grid;
        gap: 4px;
        padding: 0 10px 8px 20px;
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
        border-radius: 10px;
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
            <div class="title">Read Code In Chinese</div>
            <div class="header-actions">
              <div id="loadingSpinner" class="spinner"></div>
              <a class="chip chip-link" id="settingsButton" href="command:readCodeInChinese.openSettingsPanel">Settings</a>
              <div id="watchBadge" class="badge">Manual</div>
            </div>
          </div>
          <div class="tabs">
            <button class="tab active" id="explainTabButton" type="button">Explain</button>
            <button class="tab" id="wordbookTabButton" type="button">Wordbook</button>
          </div>
          <div id="meta" class="meta"></div>
        </div>
      </section>

      <section class="card">
        <div class="card-body stack">
          <div id="explainPage" class="page active">
            <div id="selectionFocus" class="selection-focus empty">
              <div class="label">Current Selection</div>
              <div id="selectionFocusText" class="selection-focus-text">Select code and start an explanation.</div>
              <div id="selectionFocusMeta" class="selection-focus-meta"></div>
            </div>
            <div>
              <div class="label">Summary</div>
              <div id="engineInfo" class="meta"></div>
              <div id="summary" class="summary empty">Select code and start an explanation.</div>
            </div>
            <div>
              <div class="label">Detected Type</div>
              <div id="detectedType" class="chips"></div>
            </div>
            <div>
              <div class="label">Preprocessing</div>
              <div class="progress-wrap">
                <div id="preprocessSummary" class="muted"></div>
                <div id="preprocessMeta" class="meta"></div>
                <div class="progress-bar"><div id="preprocessFill" class="progress-fill"></div></div>
              </div>
            </div>
            <div>
              <div class="label">Sections</div>
              <div id="sections" class="stack"></div>
            </div>
            <div>
              <div class="label">Workspace Index Preview</div>
              <div id="workspaceIndex" class="list"></div>
            </div>
          </div>

          <div id="wordbookPage" class="page">
            <div>
              <div class="label">Preprocessing</div>
              <div class="progress-wrap">
                <div id="wordbookPreprocessMeta" class="meta"></div>
                <div class="progress-bar"><div id="wordbookPreprocessFill" class="progress-fill"></div></div>
              </div>
            </div>
            <div>
              <div class="label">File Wordbook</div>
              <div class="wordbook-toolbar">
                <div class="wordbook-toolbar-grid">
                  <input id="wordbookSearchInput" type="search" placeholder="Search term..." />
                  <select id="wordbookScopeFilter"></select>
                </div>
                <div id="wordbookStats" class="wordbook-stats"></div>
              </div>
              <div id="wordbook" class="list"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-body">
          <div class="label">Follow-up Chat</div>
          <div id="chatHistory" class="list"></div>
          <textarea id="questionInput" placeholder="Ask a deeper question about the current code..."></textarea>
          <div class="actions">
            <div class="chat-controls">
              <span class="muted">Reasoning</span>
              <select id="reasoningEffortSelect">
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="xhigh">xhigh</option>
              </select>
            </div>
            <button class="primary" id="sendButton">Send</button>
          </div>
        </div>
      </section>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      window.addEventListener("error", (event) => {
        vscode.postMessage({
          type: "panelScriptError",
          error: event?.error?.stack || event?.message || "Unknown panel script error."
        });
      });
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event?.reason;
        vscode.postMessage({
          type: "panelScriptError",
          error:
            (reason && (reason.stack || reason.message)) ||
            String(reason || "Unknown panel promise rejection.")
        });
      });

      const watchBadge = document.getElementById("watchBadge");
      const loadingSpinner = document.getElementById("loadingSpinner");
      const settingsButton = document.getElementById("settingsButton");
      const explainTabButton = document.getElementById("explainTabButton");
      const wordbookTabButton = document.getElementById("wordbookTabButton");
      const explainPage = document.getElementById("explainPage");
      const wordbookPage = document.getElementById("wordbookPage");
      const meta = document.getElementById("meta");
      const selectionFocus = document.getElementById("selectionFocus");
      const selectionFocusText = document.getElementById("selectionFocusText");
      const selectionFocusMeta = document.getElementById("selectionFocusMeta");
      const summary = document.getElementById("summary");
      const engineInfo = document.getElementById("engineInfo");
      const detectedType = document.getElementById("detectedType");
      const preprocessSummary = document.getElementById("preprocessSummary");
      const preprocessMeta = document.getElementById("preprocessMeta");
      const preprocessFill = document.getElementById("preprocessFill");
      const wordbookPreprocessMeta = document.getElementById("wordbookPreprocessMeta");
      const wordbookPreprocessFill = document.getElementById("wordbookPreprocessFill");
      const wordbookSearchInput = document.getElementById("wordbookSearchInput");
      const wordbookScopeFilter = document.getElementById("wordbookScopeFilter");
      const wordbookStats = document.getElementById("wordbookStats");
      const wordbook = document.getElementById("wordbook");
      const sections = document.getElementById("sections");
      const workspaceIndex = document.getElementById("workspaceIndex");
      const chatHistory = document.getElementById("chatHistory");
      const questionInput = document.getElementById("questionInput");
      const reasoningEffortSelect = document.getElementById("reasoningEffortSelect");
      const sendButton = document.getElementById("sendButton");
      const persistedViewState = vscode.getState() || {
        activePage: "explain",
        wordbookTreeStateByFile: {},
        wordbookSearchByFile: {},
        wordbookFilterByFile: {}
      };
      persistedViewState.wordbookTreeStateByFile =
        persistedViewState.wordbookTreeStateByFile || {};
      persistedViewState.wordbookSearchByFile =
        persistedViewState.wordbookSearchByFile || {};
      persistedViewState.wordbookFilterByFile =
        persistedViewState.wordbookFilterByFile || {};
      let activePage = persistedViewState.activePage || "explain";
      let latestPayload = undefined;

      function setActivePage(nextPage) {
        activePage = nextPage;
        persistedViewState.activePage = nextPage;
        vscode.setState(persistedViewState);
        explainTabButton.className = nextPage === "explain" ? "tab active" : "tab";
        wordbookTabButton.className = nextPage === "wordbook" ? "tab active" : "tab";
        explainPage.className = nextPage === "explain" ? "page active" : "page";
        wordbookPage.className = nextPage === "wordbook" ? "page active" : "page";
      }

      function renderBulletList(items) {
        const list = document.createElement("ul");
        list.className = "bullet-list";
        for (const item of items) {
          const li = document.createElement("li");
          li.innerHTML = formatInlineMarkdown(item);
          list.appendChild(li);
        }
        return list;
      }

      function escapeHtml(value) {
        return String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function formatInlineMarkdown(value) {
        const placeholders = [];
        const stash = (html) => {
          placeholders.push(html);
          return "@@INLINE_TOKEN_" + (placeholders.length - 1) + "@@";
        };

        let text = escapeHtml(value || "");
        text = text.replace(/\`([^\`]+)\`/g, (_, content) => stash("<code>" + content + "</code>"));
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
        text = text.replace(/\*\*([^*]+)\*\*/g, (_, content) => stash("<strong>" + content + "</strong>"));
        text = text.replace(/__([^_]+)__/g, (_, content) => stash("<strong>" + content + "</strong>"));
        text = text.replace(/\*([^*\n]+)\*/g, (_, content) => stash("<em>" + content + "</em>"));
        text = text.replace(/_([^_\n]+)_/g, (_, content) => stash("<em>" + content + "</em>"));

        return text.replace(/@@INLINE_TOKEN_(\d+)@@/g, (_, index) => {
          return placeholders[Number(index)] || "";
        });
      }

      function renderMarkdown(value) {
        const wrapper = document.createElement("div");
        wrapper.className = "markdown";
        const normalized = String(value || "").replace(/\r\n/g, "\n");
        const lines = normalized.split("\n");
        let index = 0;

        while (index < lines.length) {
          const line = lines[index];

          if (!line.trim()) {
            index += 1;
            continue;
          }

          if (line.trim().startsWith("\`\`\`")) {
            const codeLines = [];
            index += 1;

            while (index < lines.length && !lines[index].trim().startsWith("\`\`\`")) {
              codeLines.push(lines[index]);
              index += 1;
            }

            if (index < lines.length) {
              index += 1;
            }

            const pre = document.createElement("pre");
            const code = document.createElement("code");
            code.textContent = codeLines.join("\n");
            pre.appendChild(code);
            wrapper.appendChild(pre);
            continue;
          }

          const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line.trim());

          if (headingMatch) {
            const heading = document.createElement("p");
            heading.innerHTML = "<strong>" + formatInlineMarkdown(headingMatch[2]) + "</strong>";
            wrapper.appendChild(heading);
            index += 1;
            continue;
          }

          if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
            const ordered = /^\s*\d+\.\s+/.test(line);
            const list = document.createElement(ordered ? "ol" : "ul");

            while (index < lines.length && /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[index])) {
              const itemLine = lines[index].replace(/^\s*(?:[-*+]|\d+\.)\s+/, "");
              const li = document.createElement("li");
              li.innerHTML = formatInlineMarkdown(itemLine);
              list.appendChild(li);
              index += 1;
            }

            wrapper.appendChild(list);
            continue;
          }

          const paragraphLines = [];

          while (
            index < lines.length &&
            lines[index].trim() &&
            !lines[index].trim().startsWith("\`\`\`") &&
            !/^(#{1,6})\s+/.test(lines[index].trim()) &&
            !/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[index])
          ) {
            paragraphLines.push(lines[index].trim());
            index += 1;
          }

          const paragraph = document.createElement("p");
          paragraph.innerHTML = formatInlineMarkdown(paragraphLines.join("\n")).replace(
            /\n/g,
            "<br>"
          );
          wrapper.appendChild(paragraph);
        }

        if (!wrapper.childNodes.length) {
          const paragraph = document.createElement("p");
          paragraph.textContent = value || "";
          wrapper.appendChild(paragraph);
        }

        return wrapper;
      }

      function renderSection(section) {
        const wrapper = document.createElement("div");
        wrapper.className = "section";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = section.label;

        wrapper.appendChild(label);
        if (section.items && section.items.length) {
          wrapper.appendChild(renderBulletList(section.items));
        }
        if (section.content && !(section.items && section.items.length)) {
          wrapper.appendChild(renderMarkdown(section.content));
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

        wrapper.appendChild(renderMarkdown(bodyText));
        if (metaText) {
          const meta = document.createElement("div");
          meta.className = "list-item-meta";
          meta.textContent = metaText;
          wrapper.appendChild(meta);
        }
        return wrapper;
      }

      function askQuestion(question) {
        const value = question.trim();
        if (!value) {
          return;
        }

        vscode.postMessage({
          type: "askQuestion",
          question: value
        });
      }

      function renderEmpty(container, message) {
        container.innerHTML = "";
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = message;
        container.appendChild(empty);
      }

      function renderDetectedType(value) {
        detectedType.innerHTML = "";
        if (!value) {
          renderEmpty(detectedType, "No category yet.");
          return;
        }

        const chip = document.createElement("div");
        chip.className = "chip";
        chip.textContent = value;
        detectedType.appendChild(chip);
      }

      function renderSelectionFocus(selectionText, selectionLabel, granularity) {
        if (!selectionText) {
          selectionFocus.className = "selection-focus empty";
          selectionFocusText.textContent = "Select code and start an explanation.";
          selectionFocusMeta.textContent = "";
          return;
        }

        selectionFocus.className = "selection-focus";
        selectionFocusText.textContent = selectionText;
        selectionFocusMeta.textContent = [granularity || "", selectionLabel || ""]
          .filter(Boolean)
          .join(" | ");
      }

      function getWordbookFileKey(payload) {
        return payload?.currentFile || "__global__";
      }

      function ensureWordbookTreeState(fileKey) {
        if (!persistedViewState.wordbookTreeStateByFile[fileKey]) {
          persistedViewState.wordbookTreeStateByFile[fileKey] = {};
        }

        return persistedViewState.wordbookTreeStateByFile[fileKey];
      }

      function ensureWordbookSearchValue(fileKey) {
        if (typeof persistedViewState.wordbookSearchByFile[fileKey] !== "string") {
          persistedViewState.wordbookSearchByFile[fileKey] = "";
        }

        return persistedViewState.wordbookSearchByFile[fileKey];
      }

      function ensureWordbookFilterValue(fileKey) {
        if (typeof persistedViewState.wordbookFilterByFile[fileKey] !== "string") {
          persistedViewState.wordbookFilterByFile[fileKey] = "all";
        }

        return persistedViewState.wordbookFilterByFile[fileKey];
      }

      function persistViewState() {
        vscode.setState(persistedViewState);
      }

      function bindDetailsState(details, fileKey, nodeKey, defaultOpen) {
        const treeState = ensureWordbookTreeState(fileKey);
        const storedState = treeState[nodeKey];
        details.open = typeof storedState === "boolean" ? storedState : defaultOpen;
        details.addEventListener("toggle", () => {
          treeState[nodeKey] = details.open;
          persistViewState();
        });
      }

      function bindLazyChildren(details, renderChildren) {
        const children = document.createElement("div");
        children.className = "tree-children";
        let isRendered = false;
        const ensureRendered = () => {
          if (isRendered) {
            return;
          }

          isRendered = true;
          renderChildren(children);
        };

        if (details.open) {
          ensureRendered();
        }

        details.addEventListener("toggle", () => {
          if (details.open) {
            ensureRendered();
          }
        });

        details.appendChild(children);
        return children;
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
              : ["Module Scope"];
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

      function renderWordbookEntry(entry, fileKey, layerKey, parentPath) {
        const details = document.createElement("details");
        details.className = "tree-term";
        bindDetailsState(
          details,
          fileKey,
          "layer:" + layerKey + "|term:" + parentPath.join(">") + "|" + entry.normalizedTerm,
          false
        );

        const summary = document.createElement("summary");
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = entry.term;
        summary.appendChild(label);

        const meta = document.createElement("span");
        meta.className = "tree-label-meta";
        meta.textContent = entry.category;
        summary.appendChild(meta);
        details.appendChild(summary);

        const body = document.createElement("div");
        body.className = "tree-term-body";

        const termMeta = document.createElement("div");
        termMeta.className = "tree-term-meta";
        termMeta.textContent =
          entry.category +
          " | line " +
          entry.sourceLine +
          (entry.scopePath?.length ? " | " + entry.scopePath.join(" > ") : "");
        body.appendChild(termMeta);

        const description = document.createElement("div");
        description.className = "tree-term-summary";
        description.appendChild(renderMarkdown(entry.summary));
        body.appendChild(description);

        details.appendChild(body);
        return details;
      }

      function renderWordbookGroup(group, fileKey, layerKey, parentPath) {
        const details = document.createElement("details");
        details.className = "tree-group";
        const nextPath = [...parentPath, group.label];
        bindDetailsState(
          details,
          fileKey,
          "layer:" + layerKey + "|group:" + nextPath.join(">"),
          group.label === "Module Scope"
        );

        const summary = document.createElement("summary");
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = group.label;
        summary.appendChild(label);

        const count = countGroupEntries(group);
        const meta = document.createElement("span");
        meta.className = "tree-label-meta";
        meta.textContent = String(count);
        summary.appendChild(meta);
        details.appendChild(summary);

        bindLazyChildren(details, (children) => {
          for (const childGroup of group.groups) {
            children.appendChild(renderWordbookGroup(childGroup, fileKey, layerKey, nextPath));
          }

          for (const entry of group.terms) {
            children.appendChild(renderWordbookEntry(entry, fileKey, layerKey, nextPath));
          }
        });

        return details;
      }

      function countGroupEntries(group) {
        return group.terms.length + group.groups.reduce((sum, child) => sum + countGroupEntries(child), 0);
      }

      function renderWordbookLayer(layer, fileKey) {
        const details = document.createElement("details");
        details.className = "tree-group";
        bindDetailsState(details, fileKey, "layer:" + layer.key, layer.key === "local");

        const summary = document.createElement("summary");
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = layer.label;
        summary.appendChild(label);

        const meta = document.createElement("span");
        meta.className = "tree-label-meta";
        meta.textContent = String(layer.entries.length);
        summary.appendChild(meta);
        details.appendChild(summary);

        const tree = buildWordbookTree(layer.entries);
        bindLazyChildren(details, (children) => {
          for (const group of tree.groups) {
            children.appendChild(renderWordbookGroup(group, fileKey, layer.key, []));
          }

          for (const entry of tree.terms) {
            children.appendChild(renderWordbookEntry(entry, fileKey, layer.key, []));
          }
        });

        return details;
      }

      function buildWordbookFilterOptions(payload, selectedValue) {
        const options = [
          { value: "all", label: "All scopes" },
          {
            value: "currentClass",
            label: payload?.currentClassScope
              ? "Current class: " + payload.currentClassScope.replace(/^class\s+/, "")
              : "Current class"
          },
          {
            value: "currentFunction",
            label: payload?.currentFunctionScope
              ? "Current function: " + payload.currentFunctionScope.replace(/^function\s+/, "")
              : "Current function"
          },
          {
            value: "nearSelection",
            label: payload?.currentSelectionLine
              ? "Near selection (line " + payload.currentSelectionLine + ")"
              : "Near selection"
          }
        ];
        wordbookScopeFilter.innerHTML = "";

        for (const option of options) {
          const element = document.createElement("option");
          element.value = option.value;
          element.textContent = option.label;
          wordbookScopeFilter.appendChild(element);
        }

        wordbookScopeFilter.value = options.some((option) => option.value === selectedValue)
          ? selectedValue
          : "all";
      }

      function filterWordbookEntries(entries, payload, searchValue, filterValue) {
        const normalizedSearch = (searchValue || "").trim().toLowerCase();
        let filteredEntries = [...entries];
        let emptyMessage = "No wordbook entries match the current filters.";

        if (normalizedSearch) {
          filteredEntries = filteredEntries.filter((entry) =>
            entry.term.toLowerCase().includes(normalizedSearch)
          );
        }

        if (filterValue === "currentClass") {
          if (!payload?.currentClassScope) {
            return {
              entries: [],
              emptyMessage: "Current class scope is not available for the current selection."
            };
          }

          filteredEntries = filteredEntries.filter((entry) =>
            Array.isArray(entry.scopePath) && entry.scopePath.includes(payload.currentClassScope)
          );
          emptyMessage = "No wordbook entries were found inside the current class.";
        }

        if (filterValue === "currentFunction") {
          if (!payload?.currentFunctionScope) {
            return {
              entries: [],
              emptyMessage: "Current function scope is not available for the current selection."
            };
          }

          filteredEntries = filteredEntries.filter((entry) => {
            if (!Array.isArray(entry.scopePath) || !entry.scopePath.length) {
              return false;
            }

            return entry.scopePath.includes(payload.currentFunctionScope);
          });
          emptyMessage = "No wordbook entries were found inside the current function.";
        }

        if (filterValue === "nearSelection") {
          if (!payload?.currentSelectionLine) {
            return {
              entries: [],
              emptyMessage: "Current selection line is not available for nearby filtering."
            };
          }

          filteredEntries = filteredEntries.filter((entry) => {
            return Math.abs((entry.sourceLine || 0) - payload.currentSelectionLine) <= 24;
          });
          emptyMessage = "No wordbook entries were found near the current selection.";
        }

        return {
          entries: filteredEntries,
          emptyMessage
        };
      }

      function renderWordbook(entries, payload) {
        wordbook.innerHTML = "";
        const fileKey = getWordbookFileKey(payload);
        const searchValue = ensureWordbookSearchValue(fileKey);
        const filterValue = ensureWordbookFilterValue(fileKey);
        wordbookSearchInput.value = searchValue;
        buildWordbookFilterOptions(payload, filterValue);

        if (!entries.length) {
          wordbookStats.textContent = "Run preprocessing to build the current file wordbook.";
          renderEmpty(wordbook, "Run preprocessing to build the current file wordbook.");
          return;
        }

        const filteredResult = filterWordbookEntries(entries, payload, searchValue, filterValue);
        const filteredEntries = filteredResult.entries;
        const localEntries = filteredEntries.filter(
          (entry) => (entry.symbolOrigin || "local") === "local"
        );
        const externalEntries = filteredEntries.filter((entry) => entry.symbolOrigin === "external");
        wordbookStats.textContent =
          "Showing " +
          filteredEntries.length +
          " / " +
          entries.length +
          " entries" +
          (payload?.currentScopePath?.length ? " | Scope: " + payload.currentScopePath.join(" > ") : "");

        if (!filteredEntries.length) {
          renderEmpty(wordbook, filteredResult.emptyMessage);
          return;
        }

        const container = document.createElement("div");
        container.className = "wordbook-tree";

        if (localEntries.length) {
          container.appendChild(
            renderWordbookLayer(
              {
                key: "local",
                label: "File Symbols",
                entries: localEntries
              },
              fileKey
            )
          );
        }

        if (externalEntries.length) {
          container.appendChild(
            renderWordbookLayer(
              {
                key: "external",
                label: "Library / API Symbols",
                entries: externalEntries
              },
              fileKey
            )
          );
        }

        wordbook.appendChild(container);
      }

      function renderPreprocess(progress) {
        const lines = [];
        let summaryLine = "Preprocessing has not started for the current file.";
        let percentage = 0;

        if (progress) {
          const candidatePoolCount = progress.candidatePoolCount || progress.totalCandidates;
          const selectingStep = (progress.currentStep || "").toLowerCase().includes("select");
          const preparingStep = (progress.currentStep || "").toLowerCase().includes("prepar");

          summaryLine =
            progress.status === "running"
              ? "Preprocessing is running for the current file."
              : progress.status === "completed"
                ? "Preprocessing is complete for the current file."
                : progress.status === "failed"
                  ? "Preprocessing failed for the current file."
                  : progress.status === "canceled"
                    ? "Preprocessing was canceled for the current file."
                    : "Preprocessing state is available for the current file.";

          if (selectingStep) {
            lines.push("Candidate pool: " + candidatePoolCount);
            lines.push("Selected target: " + progress.totalCandidates);
          } else {
            lines.push("Cached entries: " + progress.processedCandidates + " / " + progress.totalCandidates);
            if (candidatePoolCount !== progress.totalCandidates) {
              lines.push("Selected from: " + candidatePoolCount + " candidates");
            }
          }

          if (!selectingStep && !preparingStep && progress.batchCount > 0) {
            lines.push(
              "Batches: " +
                (progress.processedBatches || 0) +
                " / " +
                progress.batchCount
            );
          }
          if (progress.currentStep) {
            lines.push("Step: " + progress.currentStep);
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
          lines.push("Preprocessing has not started for the current file.");
        }

        preprocessSummary.textContent = summaryLine;
        preprocessMeta.innerHTML = lines.map((line) => '<div>' + line + '</div>').join("");
        preprocessFill.style.width = percentage + "%";
        wordbookPreprocessMeta.innerHTML = preprocessMeta.innerHTML;
        wordbookPreprocessFill.style.width = preprocessFill.style.width;
      }

      window.addEventListener("message", (event) => {
        const { type, payload } = event.data;

        if (type !== "render") {
          return;
        }

        latestPayload = payload;
        const explanation = payload.explanation;
        watchBadge.textContent = payload.isWatchingSelection ? "Watching selection" : "Manual";
        loadingSpinner.className = payload.isLoading ? "spinner loading" : "spinner";

        const metaLines = [
          payload.statusMessage || "Ready.",
          payload.currentFile ? "File: " + payload.currentFile : "",
          payload.currentSelectionLabel ? "Selection: " + payload.currentSelectionLabel : "",
          payload.lastUpdatedAt ? "Updated: " + payload.lastUpdatedAt : ""
        ].filter(Boolean);
        meta.innerHTML = metaLines.map((line) => '<div>' + line + '</div>').join("");

        renderSelectionFocus(
          payload.currentSelectionText || explanation?.selectionText,
          payload.currentSelectionLabel,
          payload.currentGranularity
        );

        summary.innerHTML = "";
        summary.appendChild(
          renderMarkdown(
            explanation ? explanation.summary : "Select code and start an explanation."
          )
        );
        summary.className = explanation ? "summary" : "summary empty";

        const engineLines = [
          explanation?.source ? "Engine: " + explanation.source : "",
          explanation?.note ? "Note: " + explanation.note : ""
        ].filter(Boolean);
        engineInfo.innerHTML = engineLines.map((line) => '<div>' + line + '</div>').join("");

        renderDetectedType(payload.currentGranularity);
        renderPreprocess(payload.preprocessProgress);

        renderWordbook(payload.wordbookEntries || [], payload);

        sections.innerHTML = "";
        if (explanation?.sections?.length) {
          for (const section of explanation.sections) {
            sections.appendChild(renderSection(section));
          }
        } else {
          renderEmpty(sections, "No structured sections yet.");
        }

        workspaceIndex.innerHTML = "";
        if (payload.workspaceIndex?.files?.length) {
          for (const file of payload.workspaceIndex.files.slice(0, 6)) {
            workspaceIndex.appendChild(renderListItem(file.path, file.summary));
          }
        } else {
          renderEmpty(workspaceIndex, "Workspace index preview will appear after indexing.");
        }

        chatHistory.innerHTML = "";
        if ((payload.chatHistory || []).length) {
          for (const turn of payload.chatHistory) {
            chatHistory.appendChild(
              renderListItem(turn.role === "assistant" ? "Assistant" : "You", turn.content)
            );
          }
        } else {
          renderEmpty(chatHistory, "No follow-up chat yet.");
        }

        if (payload.reasoningEffort) {
          reasoningEffortSelect.value = payload.reasoningEffort;
        }

        setActivePage(activePage);
      });

      sendButton.addEventListener("click", () => {
        askQuestion(questionInput.value);
        questionInput.value = "";
      });

      settingsButton.addEventListener("click", () => {
        setTimeout(() => {
          vscode.postMessage({ type: "openSettings" });
        }, 0);
      });

      explainTabButton.addEventListener("click", () => {
        setActivePage("explain");
      });

      wordbookTabButton.addEventListener("click", () => {
        setActivePage("wordbook");
      });

      if (wordbookSearchInput) {
        wordbookSearchInput.addEventListener("input", () => {
          const fileKey = getWordbookFileKey(latestPayload);
          persistedViewState.wordbookSearchByFile[fileKey] = wordbookSearchInput.value;
          persistViewState();

          if (latestPayload) {
            renderWordbook(latestPayload.wordbookEntries || [], latestPayload);
          }
        });
      }

      if (wordbookScopeFilter) {
        wordbookScopeFilter.addEventListener("change", () => {
          const fileKey = getWordbookFileKey(latestPayload);
          persistedViewState.wordbookFilterByFile[fileKey] = wordbookScopeFilter.value;
          persistViewState();

          if (latestPayload) {
            renderWordbook(latestPayload.wordbookEntries || [], latestPayload);
          }
        });
      }

      reasoningEffortSelect.addEventListener("change", () => {
        vscode.postMessage({
          type: "setReasoningEffort",
          reasoningEffort: reasoningEffortSelect.value
        });
      });

      questionInput.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          askQuestion(questionInput.value);
          questionInput.value = "";
        }
      });

      setActivePage(activePage);
      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
  }
}
