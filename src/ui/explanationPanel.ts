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
    this.panel.webview.onDidReceiveMessage(async (message: PanelMessage) => {
      await this.onMessage(message);
    });

    this.postState();
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Read Code In Chinese</title>
    <style>
      body {
        font-family: Georgia, "Noto Serif SC", serif;
        margin: 0;
        color: #1e1a15;
        background:
          radial-gradient(circle at top left, rgba(219, 206, 183, 0.8), transparent 28%),
          linear-gradient(180deg, #f7f0e2 0%, #efe2c2 100%);
      }

      .layout {
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        gap: 14px;
        height: 100vh;
        padding: 18px;
        box-sizing: border-box;
      }

      .card {
        background: rgba(255, 250, 241, 0.92);
        border: 1px solid rgba(76, 58, 36, 0.15);
        border-radius: 16px;
        padding: 14px 16px;
        box-shadow: 0 14px 30px rgba(52, 37, 14, 0.08);
      }

      h1, h2, p {
        margin: 0;
      }

      h1 {
        font-size: 18px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .subtitle {
        font-size: 12px;
        color: #665443;
        margin-top: 6px;
      }

      .section {
        display: grid;
        gap: 10px;
      }

      .section-item {
        padding-top: 10px;
        border-top: 1px solid rgba(76, 58, 36, 0.1);
      }

      .section-item:first-child {
        padding-top: 0;
        border-top: none;
      }

      .label {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7a6146;
        margin-bottom: 4px;
      }

      .summary {
        font-size: 14px;
        line-height: 1.5;
      }

      .status {
        font-size: 12px;
        color: #6d573f;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        border: none;
        border-radius: 999px;
        padding: 6px 10px;
        background: #c07f3b;
        color: #fff9f0;
        cursor: pointer;
      }

      .chat-history {
        display: grid;
        gap: 10px;
        max-height: 220px;
        overflow-y: auto;
      }

      .chat-turn {
        padding: 10px 12px;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.45;
        white-space: pre-wrap;
      }

      .chat-turn.user {
        background: rgba(192, 127, 59, 0.12);
      }

      .chat-turn.assistant {
        background: rgba(55, 76, 92, 0.1);
      }

      textarea {
        width: 100%;
        min-height: 72px;
        resize: vertical;
        border-radius: 12px;
        border: 1px solid rgba(76, 58, 36, 0.2);
        padding: 10px 12px;
        box-sizing: border-box;
        font-family: inherit;
        background: rgba(255, 255, 255, 0.65);
      }

      button.primary {
        margin-top: 10px;
        border: none;
        border-radius: 12px;
        padding: 10px 14px;
        background: #254441;
        color: white;
        cursor: pointer;
      }

      ul {
        margin: 0;
        padding-left: 18px;
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <div class="card">
        <h1>Read Code In Chinese</h1>
        <p class="subtitle">Selection explanation, glossary, workspace index, and follow-up chat</p>
      </div>

      <div id="statusCard" class="card status"></div>

      <div class="card section">
        <div>
          <div class="label">Explanation</div>
          <h2 id="title">No explanation yet</h2>
          <p id="summary" class="summary">Select code and run an explanation command.</p>
        </div>
        <div id="sections"></div>
        <div>
          <div class="label">Suggested Questions</div>
          <div id="suggestions" class="chips"></div>
        </div>
        <div>
          <div class="label">Workspace Index Preview</div>
          <ul id="workspaceIndex"></ul>
        </div>
      </div>

      <div class="card">
        <div class="label">Follow-up Chat</div>
        <div id="chatHistory" class="chat-history"></div>
        <textarea id="questionInput" placeholder="Ask a deeper question about the current code..."></textarea>
        <button class="primary" id="sendButton">Send</button>
      </div>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();

      const statusCard = document.getElementById("statusCard");
      const title = document.getElementById("title");
      const summary = document.getElementById("summary");
      const sections = document.getElementById("sections");
      const suggestions = document.getElementById("suggestions");
      const workspaceIndex = document.getElementById("workspaceIndex");
      const chatHistory = document.getElementById("chatHistory");
      const questionInput = document.getElementById("questionInput");
      const sendButton = document.getElementById("sendButton");

      function renderSection(section) {
        const wrapper = document.createElement("div");
        wrapper.className = "section-item";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = section.label;

        const content = document.createElement("p");
        content.className = "summary";
        content.textContent = section.content;

        wrapper.appendChild(label);
        wrapper.appendChild(content);
        return wrapper;
      }

      function renderChatTurn(turn) {
        const item = document.createElement("div");
        item.className = "chat-turn " + turn.role;
        item.textContent = turn.content;
        return item;
      }

      function askQuestion(question) {
        if (!question.trim()) {
          return;
        }

        vscode.postMessage({
          type: "askQuestion",
          question
        });
      }

      window.addEventListener("message", (event) => {
        const { type, payload } = event.data;

        if (type !== "render") {
          return;
        }

        const explanation = payload.explanation;
        title.textContent = explanation ? explanation.title : "No explanation yet";
        summary.textContent = explanation ? explanation.summary : "Select code and run an explanation command.";
        statusCard.textContent = payload.statusMessage || explanation?.note || "Ready.";

        sections.innerHTML = "";
        for (const section of explanation?.sections || []) {
          sections.appendChild(renderSection(section));
        }

        suggestions.innerHTML = "";
        for (const question of explanation?.suggestedQuestions || []) {
          const button = document.createElement("button");
          button.className = "chip";
          button.textContent = question;
          button.addEventListener("click", () => askQuestion(question));
          suggestions.appendChild(button);
        }

        workspaceIndex.innerHTML = "";
        for (const file of payload.workspaceIndex?.files?.slice(0, 8) || []) {
          const item = document.createElement("li");
          item.textContent = file.path + ": " + file.summary;
          workspaceIndex.appendChild(item);
        }

        chatHistory.innerHTML = "";
        for (const turn of payload.chatHistory || []) {
          chatHistory.appendChild(renderChatTurn(turn));
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
