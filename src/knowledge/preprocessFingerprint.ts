import { ExtensionSettings, PreprocessedSymbolCacheFile } from "../contracts";
import { createContentHash } from "../utils/hash";

export const PREPROCESS_BUILDER_VERSION = 3;

export function createPreprocessBuildFingerprint(
  settings: Pick<
    ExtensionSettings,
    | "providerId"
    | "providerBaseUrl"
    | "providerModel"
    | "providerFallbacks"
    | "professionalLevel"
    | "occupation"
    | "userGoal"
  >
): string {
  return createContentHash(
    [
      PREPROCESS_BUILDER_VERSION,
      settings.providerId,
      settings.providerBaseUrl.trim(),
      settings.providerModel.trim(),
      settings.providerFallbacks
        .map((endpoint) =>
          [endpoint.baseUrl.trim(), endpoint.apiKeyEnvVar.trim(), endpoint.model?.trim() ?? ""].join(
            "|"
          )
        )
        .join("\n"),
      settings.professionalLevel,
      settings.occupation,
      settings.userGoal.trim()
    ].join("\n")
  );
}

export function isPreprocessCacheCompatible(
  cacheFile: PreprocessedSymbolCacheFile,
  expectedFingerprint: string
): boolean {
  return (
    cacheFile.builderVersion === PREPROCESS_BUILDER_VERSION &&
    cacheFile.buildFingerprint === expectedFingerprint
  );
}
