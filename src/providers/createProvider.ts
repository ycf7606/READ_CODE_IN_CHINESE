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
    return new OpenAICompatibleProvider(settings, logger);
  }

  return new LocalExplanationProvider(logger);
}
