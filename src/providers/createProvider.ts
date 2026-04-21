import { ExtensionSettings } from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { LocalExplanationProvider } from "./localProvider";
import { OpenAICompatibleProvider } from "./openAICompatibleProvider";
import { ExplanationProvider } from "./providerTypes";

export function createProvider(
  settings: ExtensionSettings,
  logger?: ExtensionLogger
): ExplanationProvider {
  const hasRemoteConfig =
    settings.providerId === "openai-compatible" &&
    (hasCompleteEndpoint(
      settings.providerBaseUrl,
      settings.providerModel,
      settings.providerApiKeyEnvVar
    ) ||
      settings.providerFallbacks.some((fallback) =>
        hasCompleteEndpoint(fallback.baseUrl, fallback.model, fallback.apiKeyEnvVar)
      ));

  if (hasRemoteConfig) {
    logger?.info("Provider selected", {
      providerId: "openai-compatible",
      model: settings.providerModel,
      baseUrl: settings.providerBaseUrl,
      apiKeyEnvVar: settings.providerApiKeyEnvVar,
      hasApiKey: Boolean(process.env[settings.providerApiKeyEnvVar]),
      fallbackCount: settings.providerFallbacks.length
    });
    return new OpenAICompatibleProvider(settings, logger);
  }

  logger?.info("Provider selected", {
    providerId: "local",
    requestedProviderId: settings.providerId,
    hasBaseUrl: Boolean(settings.providerBaseUrl),
    hasModel: Boolean(settings.providerModel),
    apiKeyEnvVar: settings.providerApiKeyEnvVar,
    hasApiKey: Boolean(process.env[settings.providerApiKeyEnvVar]),
    fallbackCount: settings.providerFallbacks.length
  });

  return new LocalExplanationProvider(logger);
}

function hasCompleteEndpoint(
  baseUrl: string,
  model: string,
  apiKeyEnvVar: string
): boolean {
  return Boolean(baseUrl && model && apiKeyEnvVar);
}
