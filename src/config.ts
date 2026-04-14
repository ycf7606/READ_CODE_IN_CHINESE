import * as vscode from "vscode";
import {
  DetailLevel,
  ExplanationSectionName,
  ExtensionSettings,
  Occupation,
  ProviderId,
  ProfessionalLevel,
  ReasoningEffort
} from "./contracts";

export const CONFIG_NAMESPACE = "readCodeInChinese";

export function getSettings(): ExtensionSettings {
  const configuration = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  const inferredProviderId: ProviderId =
    (readStringEnv("READ_CODE_IN_CHINESE_PROVIDER_ID") as ProviderId | undefined) ??
    (readStringEnv("READ_CODE_IN_CHINESE_PROVIDER_BASE_URL") &&
    readStringEnv("READ_CODE_IN_CHINESE_PROVIDER_MODEL")
      ? "openai-compatible"
      : "local");
  const defaultSections =
    readStringArrayEnv("READ_CODE_IN_CHINESE_EXPLANATION_SECTIONS") ?? [
      "summary",
      "usage"
    ];

  return {
    autoExplainEnabled: getConfiguredValue<boolean>(
      configuration,
      "autoExplain.enabled",
      readBooleanEnv("READ_CODE_IN_CHINESE_AUTO_EXPLAIN_ENABLED") ?? false
    ),
    autoExplainDelayMs: getConfiguredValue<number>(
      configuration,
      "autoExplain.delayMs",
      readNumberEnv("READ_CODE_IN_CHINESE_AUTO_EXPLAIN_DELAY_MS") ?? 600
    ),
    autoOpenPanel: getConfiguredValue<boolean>(
      configuration,
      "ui.autoOpenPanel",
      readBooleanEnv("READ_CODE_IN_CHINESE_UI_AUTO_OPEN_PANEL") ?? true
    ),
    providerId: getConfiguredValue<ProviderId>(
      configuration,
      "provider.id",
      inferredProviderId
    ),
    providerBaseUrl: getConfiguredValue<string>(
      configuration,
      "provider.baseUrl",
      readStringEnv("READ_CODE_IN_CHINESE_PROVIDER_BASE_URL") ?? ""
    ),
    providerModel: getConfiguredValue<string>(
      configuration,
      "provider.model",
      readStringEnv("READ_CODE_IN_CHINESE_PROVIDER_MODEL") ?? ""
    ),
    providerApiKeyEnvVar: getConfiguredValue<string>(
      configuration,
      "provider.apiKeyEnvVar",
      readStringEnv("READ_CODE_IN_CHINESE_PROVIDER_API_KEY_ENV_VAR") ??
        "READ_CODE_IN_CHINESE_API_KEY"
    ),
    providerTimeoutMs: getConfiguredValue<number>(
      configuration,
      "provider.timeoutMs",
      readNumberEnv("READ_CODE_IN_CHINESE_PROVIDER_TIMEOUT_MS") ?? 20000
    ),
    providerTemperature: getConfiguredValue<number>(
      configuration,
      "provider.temperature",
      readNumberEnv("READ_CODE_IN_CHINESE_PROVIDER_TEMPERATURE") ?? 0.2
    ),
    providerTopP: getConfiguredValue<number>(
      configuration,
      "provider.topP",
      readNumberEnv("READ_CODE_IN_CHINESE_PROVIDER_TOP_P") ?? 1
    ),
    providerMaxTokens: getConfiguredValue<number>(
      configuration,
      "provider.maxTokens",
      readNumberEnv("READ_CODE_IN_CHINESE_PROVIDER_MAX_TOKENS") ?? 1200
    ),
    providerReasoningEffort: getConfiguredValue<ReasoningEffort>(
      configuration,
      "provider.reasoningEffort",
      (readStringEnv("READ_CODE_IN_CHINESE_PROVIDER_REASONING_EFFORT") as ReasoningEffort) ??
        "medium"
    ),
    detailLevel: getConfiguredValue<DetailLevel>(
      configuration,
      "explanation.detailLevel",
      (readStringEnv("READ_CODE_IN_CHINESE_EXPLANATION_DETAIL_LEVEL") as DetailLevel) ??
        "balanced"
    ),
    professionalLevel: getConfiguredValue<ProfessionalLevel>(
      configuration,
      "explanation.professionalLevel",
      (readStringEnv(
        "READ_CODE_IN_CHINESE_EXPLANATION_PROFESSIONAL_LEVEL"
      ) as ProfessionalLevel) ?? "intermediate"
    ),
    occupation: getConfiguredValue<Occupation>(
      configuration,
      "explanation.occupation",
      (readStringEnv("READ_CODE_IN_CHINESE_EXPLANATION_OCCUPATION") as Occupation) ??
        "developer"
    ),
    sections: getConfiguredValue<ExplanationSectionName[]>(
      configuration,
      "explanation.sections",
      defaultSections as ExplanationSectionName[]
    ),
    userGoal: getConfiguredValue<string>(
      configuration,
      "explanation.userGoal",
      readStringEnv("READ_CODE_IN_CHINESE_EXPLANATION_USER_GOAL") ?? ""
    ),
    knowledgeTopK: getConfiguredValue<number>(
      configuration,
      "knowledge.topK",
      readNumberEnv("READ_CODE_IN_CHINESE_KNOWLEDGE_TOP_K") ?? 3
    ),
    customInstructions: getConfiguredValue<string>(
      configuration,
      "prompt.customInstructions",
      readStringEnv("READ_CODE_IN_CHINESE_PROMPT_CUSTOM_INSTRUCTIONS") ?? ""
    )
  };
}

function getConfiguredValue<T>(
  configuration: vscode.WorkspaceConfiguration,
  key: string,
  fallback: T
): T {
  const inspected = configuration.inspect<T>(key);
  const configuredValue =
    inspected?.workspaceFolderValue ??
    inspected?.workspaceValue ??
    inspected?.globalValue;

  return configuredValue !== undefined ? configuredValue : fallback;
}

function readStringEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readNumberEnv(name: string): number | undefined {
  const value = readStringEnv(name);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readBooleanEnv(name: string): boolean | undefined {
  const value = readStringEnv(name)?.toLowerCase();

  if (!value) {
    return undefined;
  }

  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }

  if (value === "false" || value === "0" || value === "no") {
    return false;
  }

  return undefined;
}

function readStringArrayEnv(name: string): string[] | undefined {
  const value = readStringEnv(name);

  if (!value) {
    return undefined;
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parsed.length ? parsed : undefined;
}
