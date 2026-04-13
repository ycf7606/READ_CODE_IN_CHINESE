import * as vscode from "vscode";

const CONFIG_NAMESPACE = "readCodeInChinese";

type DetailLevel = "fast" | "balanced" | "deep";
type ProfessionalLevel = "beginner" | "intermediate" | "expert";

interface ExtensionSettings {
  autoExplainEnabled: boolean;
  providerId: string;
  providerBaseUrl: string;
  providerModel: string;
  apiKeyEnvVar: string;
  detailLevel: DetailLevel;
  professionalLevel: ProfessionalLevel;
  sections: string[];
}

export function activate(context: vscode.ExtensionContext): void {
  const explainSelectionCommand = vscode.commands.registerCommand(
    "readCodeInChinese.explainSelection",
    async () => {
      await explainSelection();
    }
  );

  const toggleAutoExplainCommand = vscode.commands.registerCommand(
    "readCodeInChinese.toggleAutoExplain",
    async () => {
      await toggleAutoExplain();
    }
  );

  context.subscriptions.push(explainSelectionCommand, toggleAutoExplainCommand);
}

export function deactivate(): void {}

async function explainSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    await vscode.window.showWarningMessage(
      "Read Code In Chinese: open a file before requesting an explanation."
    );
    return;
  }

  const selectedText = editor.document.getText(editor.selection).trim();

  if (!selectedText) {
    await vscode.window.showWarningMessage(
      "Read Code In Chinese: select some code before requesting an explanation."
    );
    return;
  }

  const settings = getSettings();
  const selectionPreview = shorten(selectedText, 120);

  // Keep the placeholder compact because the final UX should favor quick reading.
  const message = [
    `language=${editor.document.languageId}`,
    `detail=${settings.detailLevel}`,
    `level=${settings.professionalLevel}`,
    `provider=${settings.providerId}`,
    `sections=${settings.sections.join(",") || "none"}`,
    `selection="${selectionPreview}"`
  ].join(" | ");

  const pickedAction = await vscode.window.showInformationMessage(
    `Read Code In Chinese placeholder: ${message}`,
    "Open Settings"
  );

  if (pickedAction === "Open Settings") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      CONFIG_NAMESPACE
    );
  }
}

async function toggleAutoExplain(): Promise<void> {
  const configuration = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  const currentValue = configuration.get<boolean>("autoExplain.enabled", false);
  const nextValue = !currentValue;

  await configuration.update(
    "autoExplain.enabled",
    nextValue,
    vscode.ConfigurationTarget.Workspace
  );

  await vscode.window.showInformationMessage(
    `Read Code In Chinese: auto explain ${nextValue ? "enabled" : "disabled"} for this workspace.`
  );
}

function getSettings(): ExtensionSettings {
  const configuration = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

  return {
    autoExplainEnabled: configuration.get<boolean>("autoExplain.enabled", false),
    providerId: configuration.get<string>("provider.id", "openai-compatible"),
    providerBaseUrl: configuration.get<string>("provider.baseUrl", ""),
    providerModel: configuration.get<string>("provider.model", ""),
    apiKeyEnvVar: configuration.get<string>(
      "provider.apiKeyEnvVar",
      "READ_CODE_IN_CHINESE_API_KEY"
    ),
    detailLevel: configuration.get<DetailLevel>(
      "explanation.detailLevel",
      "balanced"
    ),
    professionalLevel: configuration.get<ProfessionalLevel>(
      "explanation.professionalLevel",
      "intermediate"
    ),
    sections: configuration.get<string[]>("explanation.sections", [
      "summary",
      "usage"
    ])
  };
}

function shorten(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}
