import * as vscode from "vscode";
import {
  ExtensionSettings,
  ExplanationSectionName,
  Occupation,
  ProviderId,
  ReasoningEffort
} from "../contracts";

interface SettingsPayload {
  settings: ExtensionSettings;
  statusMessage?: string;
}

type PromptGenerationPayload = {
  providerId: ProviderId;
  providerBaseUrl: string;
  providerModel: string;
  providerApiKeyEnvVar: string;
  providerTimeoutMs: number;
  occupation: Occupation;
  userGoal: string;
  detailLevel: ExtensionSettings["detailLevel"];
  professionalLevel: ExtensionSettings["professionalLevel"];
  sections: ExplanationSectionName[];
  reasoningEffort: ReasoningEffort;
  temperature: number;
  topP: number;
  maxTokens: number;
};

type SettingsMessage =
  | { type: "ready" }
  | { type: "runPreprocess" }
  | {
      type: "generatePrompt";
      payload: PromptGenerationPayload;
    }
  | {
      type: "saveSettings";
      payload: {
        providerId: ProviderId;
        providerBaseUrl: string;
        providerModel: string;
        providerApiKeyEnvVar: string;
        providerTimeoutMs: number;
        customInstructions: string;
        userGoal: string;
        detailLevel: ExtensionSettings["detailLevel"];
        professionalLevel: ExtensionSettings["professionalLevel"];
        occupation: Occupation;
        sections: ExplanationSectionName[];
        temperature: number;
        topP: number;
        maxTokens: number;
        reasoningEffort: ReasoningEffort;
        autoExplainEnabled: boolean;
        preprocessIncludeAllCandidates: boolean;
      };
    };

export class SettingsPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private state: SettingsPayload | undefined;

  constructor(
    private readonly onMessage: (message: SettingsMessage) => Promise<void>
  ) {}

  show(settings: ExtensionSettings): void {
    this.state = {
      settings,
      statusMessage: this.state?.statusMessage
    };

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      this.postState();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "readCodeInChinese.settingsPanel",
      "Read Code In Chinese Settings",
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
    this.panel.webview.onDidReceiveMessage(async (message: SettingsMessage) => {
      await this.onMessage(message);
    });

    this.postState();
  }

  setDraftGlobalPrompt(prompt: string): void {
    if (!this.state) {
      return;
    }

    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        customInstructions: prompt
      }
    };
    this.postState();
  }

  setStatusMessage(statusMessage: string | undefined): void {
    if (!this.state) {
      return;
    }

    this.state = {
      ...this.state,
      statusMessage
    };
    this.postState();
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private postState(): void {
    if (!this.panel || !this.state) {
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
    <title>Read Code In Chinese Settings</title>
    <style>
      body {
        margin: 0;
        padding: 18px;
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        font: 13px/1.6 var(--vscode-font-family);
      }

      .layout {
        display: grid;
        gap: 14px;
      }

      .card {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 12px;
        padding: 14px;
        background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-editorWidget-background) 6%);
      }

      h1, h2, p {
        margin: 0;
      }

      h1 {
        font-size: 15px;
        margin-bottom: 6px;
      }

      .muted {
        color: var(--vscode-descriptionForeground);
      }

      .status {
        margin-top: 8px;
        color: var(--vscode-descriptionForeground);
      }

      .grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      label {
        display: grid;
        gap: 6px;
      }

      textarea,
      input,
      select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--vscode-input-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font: inherit;
        box-sizing: border-box;
      }

      textarea {
        min-height: 140px;
        resize: vertical;
      }

      .checkboxes {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 16px;
      }

      .checkboxes label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }

      button {
        border: 0;
        border-radius: 8px;
        padding: 8px 12px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        cursor: pointer;
      }

      button:hover {
        background: var(--vscode-button-hoverBackground);
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <section class="card">
        <h1>Read Code In Chinese Settings</h1>
        <p class="muted">Configure provider settings, audience profile, preprocessing behavior, and the editable global prompt used in runtime prompts.</p>
        <div id="statusMessage" class="status"></div>
      </section>

      <section class="card">
        <h2>Provider</h2>
        <p class="muted" style="margin-top: 6px;">Configure the remote endpoint without storing the secret itself inside Git-tracked files.</p>
        <div class="grid" style="margin-top: 10px;">
          <label>
            <span>Provider Mode</span>
            <select id="providerId">
              <option value="local">local</option>
              <option value="openai-compatible">openai-compatible</option>
            </select>
          </label>
          <label>
            <span>Base URL</span>
            <input id="providerBaseUrl" />
          </label>
          <label>
            <span>Model</span>
            <input id="providerModel" />
          </label>
          <label>
            <span>API Key Env Var</span>
            <input id="providerApiKeyEnvVar" />
          </label>
          <label>
            <span>Timeout (ms)</span>
            <input id="providerTimeoutMs" type="number" step="1000" min="1000" />
          </label>
        </div>
      </section>

      <section class="card">
        <h2>Audience</h2>
        <div class="grid" style="margin-top: 10px;">
          <label>
            <span>Occupation</span>
            <select id="occupation">
              <option value="student">student</option>
              <option value="developer">developer</option>
              <option value="data-scientist">data-scientist</option>
              <option value="researcher">researcher</option>
              <option value="maintainer">maintainer</option>
            </select>
          </label>
          <label>
            <span>Detail Level</span>
            <select id="detailLevel">
              <option value="fast">fast</option>
              <option value="balanced">balanced</option>
              <option value="deep">deep</option>
            </select>
          </label>
          <label>
            <span>Professional Level</span>
            <select id="professionalLevel">
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="expert">expert</option>
            </select>
          </label>
          <label>
            <span>User Goal</span>
            <input id="userGoal" />
          </label>
        </div>
      </section>

      <section class="card">
        <h2>Hyperparameters</h2>
        <div class="grid" style="margin-top: 10px;">
          <label>
            <span>Reasoning Effort</span>
            <select id="reasoningEffort">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="xhigh">xhigh</option>
            </select>
          </label>
          <label>
            <span>Temperature</span>
            <input id="temperature" type="number" step="0.1" min="0" max="2" />
          </label>
          <label>
            <span>Top P</span>
            <input id="topP" type="number" step="0.1" min="0" max="1" />
          </label>
          <label>
            <span>Max Tokens</span>
            <input id="maxTokens" type="number" step="1" min="64" />
          </label>
        </div>
        <label style="margin-top: 10px; display: inline-flex; align-items: center; gap: 8px;">
          <input id="autoExplainEnabled" type="checkbox" style="width:auto;" />
          <span>Enable auto explain</span>
        </label>
        <label style="margin-top: 10px; display: inline-flex; align-items: center; gap: 8px;">
          <input id="preprocessIncludeAllCandidates" type="checkbox" style="width:auto;" />
          <span>Preprocess all file-local tokens</span>
        </label>
      </section>

      <section class="card">
        <h2>Sections</h2>
        <div class="checkboxes" style="margin-top: 10px;">
          <label><input type="checkbox" value="summary" /> summary</label>
          <label><input type="checkbox" value="inputOutput" /> inputOutput</label>
          <label><input type="checkbox" value="usage" /> usage</label>
          <label><input type="checkbox" value="syntax" /> syntax</label>
          <label><input type="checkbox" value="risk" /> risk</label>
        </div>
      </section>

      <section class="card">
        <h2>Global Prompt</h2>
        <p class="muted" style="margin-top: 6px;">Generate a prompt from the profile above, then edit it if needed. This text is used in runtime prompts.</p>
        <label style="margin-top: 10px;">
          <span>Editable Prompt</span>
          <textarea id="customInstructions"></textarea>
        </label>
      </section>

      <div class="actions">
        <button id="generatePromptButton" type="button">Generate Prompt</button>
        <button id="runPreprocessButton" type="button">Preprocess Current File</button>
        <button id="saveButton">Save Settings</button>
      </div>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();

      const customInstructions = document.getElementById("customInstructions");
      const providerId = document.getElementById("providerId");
      const providerBaseUrl = document.getElementById("providerBaseUrl");
      const providerModel = document.getElementById("providerModel");
      const providerApiKeyEnvVar = document.getElementById("providerApiKeyEnvVar");
      const providerTimeoutMs = document.getElementById("providerTimeoutMs");
      const userGoal = document.getElementById("userGoal");
      const detailLevel = document.getElementById("detailLevel");
      const professionalLevel = document.getElementById("professionalLevel");
      const occupation = document.getElementById("occupation");
      const reasoningEffort = document.getElementById("reasoningEffort");
      const temperature = document.getElementById("temperature");
      const topP = document.getElementById("topP");
      const maxTokens = document.getElementById("maxTokens");
      const autoExplainEnabled = document.getElementById("autoExplainEnabled");
      const preprocessIncludeAllCandidates = document.getElementById("preprocessIncludeAllCandidates");
      const generatePromptButton = document.getElementById("generatePromptButton");
      const runPreprocessButton = document.getElementById("runPreprocessButton");
      const saveButton = document.getElementById("saveButton");
      const statusMessage = document.getElementById("statusMessage");

      function setSections(values) {
        const checkboxes = document.querySelectorAll('.checkboxes input[type="checkbox"]');
        for (const checkbox of checkboxes) {
          checkbox.checked = values.includes(checkbox.value);
        }
      }

      function getSections() {
        return Array.from(document.querySelectorAll('.checkboxes input[type="checkbox"]'))
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => checkbox.value);
      }

      window.addEventListener("message", (event) => {
        const { type, payload } = event.data;

        if (type !== "render") {
          return;
        }

        const settings = payload.settings;
        statusMessage.textContent = payload.statusMessage || "";
        providerId.value = settings.providerId;
        providerBaseUrl.value = settings.providerBaseUrl || "";
        providerModel.value = settings.providerModel || "";
        providerApiKeyEnvVar.value = settings.providerApiKeyEnvVar || "";
        providerTimeoutMs.value = String(settings.providerTimeoutMs);
        customInstructions.value = settings.customInstructions || "";
        userGoal.value = settings.userGoal || "";
        detailLevel.value = settings.detailLevel;
        professionalLevel.value = settings.professionalLevel;
        occupation.value = settings.occupation;
        reasoningEffort.value = settings.providerReasoningEffort;
        temperature.value = String(settings.providerTemperature);
        topP.value = String(settings.providerTopP);
        maxTokens.value = String(settings.providerMaxTokens);
        autoExplainEnabled.checked = Boolean(settings.autoExplainEnabled);
        preprocessIncludeAllCandidates.checked = Boolean(settings.preprocessIncludeAllCandidates);
        setSections(settings.sections || []);
      });

      generatePromptButton.addEventListener("click", () => {
        vscode.postMessage({
          type: "generatePrompt",
          payload: {
            providerId: providerId.value,
            providerBaseUrl: providerBaseUrl.value,
            providerModel: providerModel.value,
            providerApiKeyEnvVar: providerApiKeyEnvVar.value,
            providerTimeoutMs: Number(providerTimeoutMs.value),
            occupation: occupation.value,
            userGoal: userGoal.value,
            detailLevel: detailLevel.value,
            professionalLevel: professionalLevel.value,
            sections: getSections(),
            reasoningEffort: reasoningEffort.value,
            temperature: Number(temperature.value),
            topP: Number(topP.value),
            maxTokens: Number(maxTokens.value)
          }
        });
      });

      runPreprocessButton.addEventListener("click", () => {
        vscode.postMessage({ type: "runPreprocess" });
      });

      saveButton.addEventListener("click", () => {
        vscode.postMessage({
          type: "saveSettings",
          payload: {
            providerId: providerId.value,
            providerBaseUrl: providerBaseUrl.value,
            providerModel: providerModel.value,
            providerApiKeyEnvVar: providerApiKeyEnvVar.value,
            providerTimeoutMs: Number(providerTimeoutMs.value),
            customInstructions: customInstructions.value,
            userGoal: userGoal.value,
            detailLevel: detailLevel.value,
            professionalLevel: professionalLevel.value,
            occupation: occupation.value,
            sections: getSections(),
            temperature: Number(temperature.value),
            topP: Number(topP.value),
            maxTokens: Number(maxTokens.value),
            reasoningEffort: reasoningEffort.value,
            autoExplainEnabled: autoExplainEnabled.checked,
            preprocessIncludeAllCandidates: preprocessIncludeAllCandidates.checked
          }
        });
      });

      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
  }
}
