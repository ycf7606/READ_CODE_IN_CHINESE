import { ExtensionSettings } from "../contracts";
import { LocalExplanationProvider } from "./localProvider";
import { OpenAICompatibleProvider } from "./openAICompatibleProvider";
import { ExplanationProvider } from "./providerTypes";

export function createProvider(settings: ExtensionSettings): ExplanationProvider {
  const hasRemoteConfig =
    settings.providerId === "openai-compatible" &&
    Boolean(settings.providerBaseUrl) &&
    Boolean(settings.providerModel) &&
    Boolean(process.env[settings.providerApiKeyEnvVar]);

  if (hasRemoteConfig) {
    return new OpenAICompatibleProvider(settings);
  }

  return new LocalExplanationProvider();
}
