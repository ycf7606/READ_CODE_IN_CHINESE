import * as vscode from "vscode";
import {
  ExtensionSettings,
  ExplanationSectionName,
  Occupation,
  ProviderEndpoint,
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
  providerFallbacks: ProviderEndpoint[];
  providerTimeoutMs: number;
  providerRequireTrustedWorkspace: boolean;
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
        providerFallbacks: ProviderEndpoint[];
        providerTimeoutMs: number;
        providerRequireTrustedWorkspace: boolean;
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
        preprocessMode: ExtensionSettings["preprocessMode"];
        preprocessExclude: string[];
        preprocessMaxFileBytes: number;
        preprocessMaxCandidates: number;
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
      "中文读代码 · 设置",
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
      try {
        await this.onMessage(message);
      } catch (error) {
        this.setStatusMessage(
          `设置操作失败：${error instanceof Error ? error.message : String(error)}`
        );
      }
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
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>中文读代码 · 设置</title>
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
        border-radius: 8px;
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
        <h1>中文读代码 · 设置</h1>
        <p class="muted">配置模型、用户画像、隐私策略、文件预处理和运行时提示词。</p>
        <div id="statusMessage" class="status"></div>
      </section>

      <section class="card">
        <h2>模型服务</h2>
        <p class="muted" style="margin-top: 6px;">配置远端接口；密钥仍由环境变量提供，不写入 Git 跟踪文件。</p>
        <div class="grid" style="margin-top: 10px;">
          <label>
            <span>服务模式</span>
            <select id="providerId">
              <option value="local">本地分析</option>
              <option value="openai-compatible">OpenAI 兼容接口</option>
            </select>
          </label>
          <label>
            <span>Base URL</span>
            <input id="providerBaseUrl" />
          </label>
          <label>
            <span>模型名称</span>
            <input id="providerModel" />
          </label>
          <label>
            <span>API Key 环境变量</span>
            <input id="providerApiKeyEnvVar" />
          </label>
          <label style="grid-column: 1 / -1;">
            <span>备用接口</span>
            <textarea id="providerFallbacks" style="min-height: 96px;"></textarea>
            <span class="muted">每行一个：<code>baseUrl | apiKeyEnvVar | optionalModel</code></span>
          </label>
          <label>
            <span>超时时间（毫秒）</span>
            <input id="providerTimeoutMs" type="number" step="1000" min="1000" />
          </label>
          <label style="grid-column: 1 / -1; display: inline-flex; align-items: center; gap: 8px;">
            <input id="providerRequireTrustedWorkspace" type="checkbox" style="width:auto;" />
            <span>仅在受信任工作区使用远端模型</span>
          </label>
        </div>
      </section>

      <section class="card">
        <h2>文件预处理</h2>
        <p class="muted" style="margin-top: 6px;">控制何时发送经过裁剪的符号上下文，并限制敏感文件、文件大小和候选数量。</p>
        <div class="grid" style="margin-top: 10px;">
          <label>
            <span>运行模式</span>
            <select id="preprocessMode">
              <option value="off">关闭</option>
              <option value="manual">仅手动</option>
              <option value="onSave">保存时</option>
              <option value="idle">空闲时自动</option>
            </select>
          </label>
          <label>
            <span>最大文件字节数</span>
            <input id="preprocessMaxFileBytes" type="number" step="1024" min="1024" />
          </label>
          <label>
            <span>最大候选符号数</span>
            <input id="preprocessMaxCandidates" type="number" step="1" min="1" max="1000" />
          </label>
          <label style="grid-column: 1 / -1;">
            <span>排除规则</span>
            <textarea id="preprocessExclude" style="min-height: 112px;"></textarea>
            <span class="muted">每行一个 glob，例如 <code>**/.env*</code> 或 <code>**/*.pem</code></span>
          </label>
        </div>
      </section>

      <section class="card">
        <h2>用户画像</h2>
        <div class="grid" style="margin-top: 10px;">
          <label>
            <span>使用场景</span>
            <select id="occupation">
              <option value="student">学生</option>
              <option value="developer">开发者</option>
              <option value="data-scientist">数据科学</option>
              <option value="researcher">科研</option>
              <option value="maintainer">维护者</option>
            </select>
          </label>
          <label>
            <span>解释深度</span>
            <select id="detailLevel">
              <option value="fast">快速</option>
              <option value="balanced">均衡</option>
              <option value="deep">深入</option>
            </select>
          </label>
          <label>
            <span>专业程度</span>
            <select id="professionalLevel">
              <option value="beginner">入门</option>
              <option value="intermediate">中级</option>
              <option value="expert">专家</option>
            </select>
          </label>
          <label>
            <span>阅读目标</span>
            <input id="userGoal" />
          </label>
        </div>
      </section>

      <section class="card">
        <h2>生成参数</h2>
        <div class="grid" style="margin-top: 10px;">
          <label>
            <span>推理强度</span>
            <select id="reasoningEffort">
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="xhigh">极高</option>
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
            <span>最大输出 Tokens</span>
            <input id="maxTokens" type="number" step="1" min="64" />
          </label>
        </div>
        <label style="margin-top: 10px; display: inline-flex; align-items: center; gap: 8px;">
          <input id="autoExplainEnabled" type="checkbox" style="width:auto;" />
          <span>启用自动解释</span>
        </label>
      </section>

      <section class="card">
        <h2>解释区块</h2>
        <div class="checkboxes" style="margin-top: 10px;">
          <label><input type="checkbox" value="summary" /> 概要</label>
          <label><input type="checkbox" value="inputOutput" /> 输入与输出</label>
          <label><input type="checkbox" value="usage" /> 当前用途</label>
          <label><input type="checkbox" value="syntax" /> 语法结构</label>
          <label><input type="checkbox" value="risk" /> 风险提示</label>
        </div>
      </section>

      <section class="card">
        <h2>全局提示词</h2>
        <p class="muted" style="margin-top: 6px;">根据上方画像生成提示词，并可在保存前继续编辑。</p>
        <label style="margin-top: 10px;">
          <span>可编辑提示词</span>
          <textarea id="customInstructions"></textarea>
        </label>
      </section>

      <div class="actions">
        <button id="generatePromptButton" type="button">生成提示词</button>
        <button id="runPreprocessButton" type="button">预处理当前文件</button>
        <button id="saveButton">保存设置</button>
      </div>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();

      const customInstructions = document.getElementById("customInstructions");
      const providerId = document.getElementById("providerId");
      const providerBaseUrl = document.getElementById("providerBaseUrl");
      const providerModel = document.getElementById("providerModel");
      const providerApiKeyEnvVar = document.getElementById("providerApiKeyEnvVar");
      const providerFallbacks = document.getElementById("providerFallbacks");
      const providerTimeoutMs = document.getElementById("providerTimeoutMs");
      const providerRequireTrustedWorkspace = document.getElementById("providerRequireTrustedWorkspace");
      const preprocessMode = document.getElementById("preprocessMode");
      const preprocessExclude = document.getElementById("preprocessExclude");
      const preprocessMaxFileBytes = document.getElementById("preprocessMaxFileBytes");
      const preprocessMaxCandidates = document.getElementById("preprocessMaxCandidates");
      const userGoal = document.getElementById("userGoal");
      const detailLevel = document.getElementById("detailLevel");
      const professionalLevel = document.getElementById("professionalLevel");
      const occupation = document.getElementById("occupation");
      const reasoningEffort = document.getElementById("reasoningEffort");
      const temperature = document.getElementById("temperature");
      const topP = document.getElementById("topP");
      const maxTokens = document.getElementById("maxTokens");
      const autoExplainEnabled = document.getElementById("autoExplainEnabled");
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

      function serializeFallbacks(entries) {
        return (entries || [])
          .map((entry) => {
            const baseUrl = (entry.baseUrl || "").trim();
            const apiKeyEnvVar = (entry.apiKeyEnvVar || "").trim();
            const model = (entry.model || "").trim();

            if (!baseUrl || !apiKeyEnvVar) {
              return "";
            }

            return model
              ? [baseUrl, apiKeyEnvVar, model].join(" | ")
              : [baseUrl, apiKeyEnvVar].join(" | ");
          })
          .filter(Boolean)
          .join("\\n");
      }

      function parseFallbacks(value) {
        return String(value || "")
          .split(/\\r?\\n/u)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [baseUrl = "", apiKeyEnvVar = "", model = ""] = line
              .split("|")
              .map((part) => part.trim());

            if (!baseUrl || !apiKeyEnvVar) {
              return undefined;
            }

            return {
              baseUrl,
              apiKeyEnvVar,
              ...(model ? { model } : {})
            };
          })
          .filter(Boolean);
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
        providerFallbacks.value = serializeFallbacks(settings.providerFallbacks || []);
        providerTimeoutMs.value = String(settings.providerTimeoutMs);
        providerRequireTrustedWorkspace.checked = Boolean(settings.providerRequireTrustedWorkspace);
        preprocessMode.value = settings.preprocessMode;
        preprocessExclude.value = (settings.preprocessExclude || []).join("\n");
        preprocessMaxFileBytes.value = String(settings.preprocessMaxFileBytes);
        preprocessMaxCandidates.value = String(settings.preprocessMaxCandidates);
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
            providerFallbacks: parseFallbacks(providerFallbacks.value),
            providerTimeoutMs: Number(providerTimeoutMs.value),
            providerRequireTrustedWorkspace: providerRequireTrustedWorkspace.checked,
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
            providerFallbacks: parseFallbacks(providerFallbacks.value),
            providerTimeoutMs: Number(providerTimeoutMs.value),
            providerRequireTrustedWorkspace: providerRequireTrustedWorkspace.checked,
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
            preprocessMode: preprocessMode.value,
            preprocessExclude: String(preprocessExclude.value || "")
              .split(/\r?\n/u)
              .map((entry) => entry.trim())
              .filter(Boolean),
            preprocessMaxFileBytes: Number(preprocessMaxFileBytes.value),
            preprocessMaxCandidates: Number(preprocessMaxCandidates.value)
          }
        });
      });

      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
  }
}
