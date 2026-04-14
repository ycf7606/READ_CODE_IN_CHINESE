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
    Boolean(settings.providerBaseUrl) &&
    Boolean(settings.providerModel);

  if (hasRemoteConfig) {
    logger?.info("Provider selected", {
      providerId: "openai-compatible",
      model: settings.providerModel,
      baseUrl: settings.providerBaseUrl,
      apiKeyEnvVar: settings.providerApiKeyEnvVar,
      hasApiKey: Boolean(process.env[settings.providerApiKeyEnvVar])
    });
    return new OpenAICompatibleProvider(settings, logger);
  }

  logger?.info("Provider selected", {
    providerId: "local",
    requestedProviderId: settings.providerId,
    hasBaseUrl: Boolean(settings.providerBaseUrl),
    hasModel: Boolean(settings.providerModel),
    apiKeyEnvVar: settings.providerApiKeyEnvVar,
    hasApiKey: Boolean(process.env[settings.providerApiKeyEnvVar])
  });

  return new LocalExplanationProvider(logger);
}
