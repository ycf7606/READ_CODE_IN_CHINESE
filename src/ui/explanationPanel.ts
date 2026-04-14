import * as vscode from "vscode";
import {
  ChatTurn,
  ExplanationResponse,
  GlossaryEntry,
  WorkspaceIndex
} from "../contracts";

export interface ExplanationPanelState {
  explanation?: ExplanationResponse;
  chatHistory: ChatTurn[];
  workspaceIndex?: WorkspaceIndex;
  glossaryEntries: GlossaryEntry[];
  statusMessage?: string;
  isWatchingSelection?: boolean;
  currentFile?: string;
  currentSelectionLabel?: string;
  lastUpdatedAt?: string;
}

type PanelMessage =
  | { type: "ready" }
  | { type: "askQuestion"; question: string };

export class ExplanationPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private state: ExplanationPanelState = {
    chatHistory: [],
    glossaryEntries: []
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
      await this.onMessage(message);
    });

    this.postState();
  }

  isWatchingSelection(): boolean {
    return Boolean(this.panel);
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
        justify-content: flex-end;
        margin-top: 10px;
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
    </style>
  </head>
  <body>
    <div class="layout">
      <section class="card">
        <div class="card-body">
          <div class="header">
            <div class="title">Read Code In Chinese</div>
            <div id="watchBadge" class="badge">Manual</div>
          </div>
          <div id="meta" class="meta"></div>
        </div>
      </section>

      <section class="card">
        <div class="card-body stack">
          <div>
          <div class="label">Summary</div>
            <div id="engineInfo" class="meta"></div>
            <div id="summary" class="summary empty">Select code and start an explanation.</div>
          </div>
          <div>
            <div class="label">Sections</div>
            <div id="sections" class="stack"></div>
          </div>
          <div>
            <div class="label">Suggested Questions</div>
            <div id="suggestions" class="chips"></div>
          </div>
          <div>
            <div class="label">Glossary Snapshot</div>
            <div id="glossary" class="glossary"></div>
          </div>
          <div>
            <div class="label">Workspace Index Preview</div>
            <div id="workspaceIndex" class="list"></div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-body">
          <div class="label">Follow-up Chat</div>
          <div id="chatHistory" class="list"></div>
          <textarea id="questionInput" placeholder="Ask a deeper question about the current code..."></textarea>
          <div class="actions">
            <button class="primary" id="sendButton">Send</button>
          </div>
        </div>
      </section>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();

      const watchBadge = document.getElementById("watchBadge");
      const meta = document.getElementById("meta");
      const summary = document.getElementById("summary");
      const engineInfo = document.getElementById("engineInfo");
      const sections = document.getElementById("sections");
      const suggestions = document.getElementById("suggestions");
      const glossary = document.getElementById("glossary");
      const workspaceIndex = document.getElementById("workspaceIndex");
      const chatHistory = document.getElementById("chatHistory");
      const questionInput = document.getElementById("questionInput");
      const sendButton = document.getElementById("sendButton");

      function renderSection(section) {
        const wrapper = document.createElement("div");
        wrapper.className = "section";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = section.label;

        const content = document.createElement("div");
        content.className = "summary";
        content.textContent = section.content;

        wrapper.appendChild(label);
        wrapper.appendChild(content);
        return wrapper;
      }

      function renderListItem(titleText, bodyText) {
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

      window.addEventListener("message", (event) => {
        const { type, payload } = event.data;

        if (type !== "render") {
          return;
        }

        const explanation = payload.explanation;
        watchBadge.textContent = payload.isWatchingSelection ? "Watching selection" : "Manual";

        const metaLines = [
          payload.statusMessage || "Ready.",
          payload.currentFile ? "File: " + payload.currentFile : "",
          payload.currentSelectionLabel ? "Selection: " + payload.currentSelectionLabel : "",
          payload.lastUpdatedAt ? "Updated: " + payload.lastUpdatedAt : ""
        ].filter(Boolean);
        meta.innerHTML = metaLines.map((line) => '<div>' + line + '</div>').join("");

        summary.textContent = explanation
          ? explanation.summary
          : "Select code and start an explanation.";
        summary.className = explanation ? "summary" : "summary empty";

        const engineLines = [
          explanation?.source ? "Engine: " + explanation.source : "",
          explanation?.note ? "Note: " + explanation.note : ""
        ].filter(Boolean);
        engineInfo.innerHTML = engineLines.map((line) => '<div>' + line + '</div>').join("");

        sections.innerHTML = "";
        if (explanation?.sections?.length) {
          for (const section of explanation.sections) {
            sections.appendChild(renderSection(section));
          }
        } else {
          renderEmpty(sections, "No structured sections yet.");
        }

        suggestions.innerHTML = "";
        if (explanation?.suggestedQuestions?.length) {
          for (const question of explanation.suggestedQuestions) {
            const button = document.createElement("button");
            button.className = "chip";
            button.textContent = question;
            button.addEventListener("click", () => askQuestion(question));
            suggestions.appendChild(button);
          }
        } else {
          const item = document.createElement("div");
          item.className = "empty";
          item.textContent = "Suggested follow-up questions will appear here.";
          suggestions.appendChild(item);
        }

        glossary.innerHTML = "";
        if ((payload.glossaryEntries || []).length) {
          for (const entry of payload.glossaryEntries.slice(0, 6)) {
            glossary.appendChild(renderGlossaryItem(entry));
          }
        } else {
          renderEmpty(glossary, "No glossary entries for the current file.");
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
      });

      sendButton.addEventListener("click", () => {
        askQuestion(questionInput.value);
        questionInput.value = "";
      });

      questionInput.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          askQuestion(questionInput.value);
          questionInput.value = "";
        }
      });

      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
  }
}
