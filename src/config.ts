import * as vscode from "vscode";
import {
  DetailLevel,
  ExplanationSectionName,
  ExtensionSettings,
  ProfessionalLevel
} from "./contracts";

export const CONFIG_NAMESPACE = "readCodeInChinese";

export function getSettings(): ExtensionSettings {
  const configuration = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

  return {
    autoExplainEnabled: configuration.get<boolean>("autoExplain.enabled", false),
    autoExplainDelayMs: configuration.get<number>("autoExplain.delayMs", 600),
    autoOpenPanel: configuration.get<boolean>("ui.autoOpenPanel", true),
    providerId: configuration.get<string>("provider.id", "local"),
    providerBaseUrl: configuration.get<string>("provider.baseUrl", ""),
    providerModel: configuration.get<string>("provider.model", ""),
    providerApiKeyEnvVar: configuration.get<string>(
      "provider.apiKeyEnvVar",
      "READ_CODE_IN_CHINESE_API_KEY"
    ),
    providerTimeoutMs: configuration.get<number>("provider.timeoutMs", 20000),
    detailLevel: configuration.get<DetailLevel>(
      "explanation.detailLevel",
      "balanced"
    ),
    professionalLevel: configuration.get<ProfessionalLevel>(
      "explanation.professionalLevel",
      "intermediate"
    ),
    sections: configuration.get<ExplanationSectionName[]>(
      "explanation.sections",
      ["summary", "usage"]
    ),
    userGoal: configuration.get<string>("explanation.userGoal", ""),
    knowledgeTopK: configuration.get<number>("knowledge.topK", 3)
  };
}
