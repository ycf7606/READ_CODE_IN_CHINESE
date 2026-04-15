import { ExtensionSettings } from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { LocalExplanationProvider } from "./localProvider";
import { OpenAICompatibleProvider } from "./openAICompatibleProvider";
import { ExplanationProvider } from "./providerTypes";

export function createProvider(
  settings: ExtensionSettings,
  logger?: ExtensionLogger
): ExplanationProvider {
  const hasPrimaryRemoteConfig =
    Boolean(settings.providerBaseUrl) && Boolean(settings.providerModel);
  const fallbackCount = settings.providerFallbacks.filter(
    (endpoint) => Boolean(endpoint.baseUrl) && Boolean(endpoint.apiKeyEnvVar)
  ).length;
  const hasRemoteConfig =
    settings.providerId === "openai-compatible" &&
    (hasPrimaryRemoteConfig || fallbackCount > 0);

  if (hasRemoteConfig) {
    logger?.info("Provider selected", {
      providerId: "openai-compatible",
      model: settings.providerModel,
      baseUrl: settings.providerBaseUrl,
      apiKeyEnvVar: settings.providerApiKeyEnvVar,
      hasApiKey: Boolean(process.env[settings.providerApiKeyEnvVar]),
      fallbackCount
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
    fallbackCount
  });

  return new LocalExplanationProvider(logger);
}
