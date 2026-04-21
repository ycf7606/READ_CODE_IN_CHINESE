const fs = require("fs");
const os = require("os");
const path = require("path");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    process.env[match[1]] = match[2];
  }
}

async function main() {
  loadDotEnv(path.join(process.cwd(), ".vscode", ".env"));

  const providerApiKeyEnvVar =
    process.env.READ_CODE_IN_CHINESE_PROVIDER_API_KEY_ENV_VAR ||
    "READ_CODE_IN_CHINESE_API_KEY";
  const providerBaseUrl = process.env.READ_CODE_IN_CHINESE_PROVIDER_BASE_URL || "";
  const providerModel = process.env.READ_CODE_IN_CHINESE_PROVIDER_MODEL || "";

  if (!providerBaseUrl || !providerModel || !process.env[providerApiKeyEnvVar]) {
    throw new Error(
      `Remote smoke preprocess requires base URL, model, and ${providerApiKeyEnvVar}.`
    );
  }

  const { extractGlossaryEntries } = require("../dist/analysis/glossary.js");
  const { buildPreprocessCandidatePool } = require("../dist/analysis/preprocess.js");
  const {
    buildSymbolPreprocessCache
  } = require("../dist/knowledge/symbolPreprocessBuilder.js");
  const {
    OpenAICompatibleProvider
  } = require("../dist/providers/openAICompatibleProvider.js");
  const { WorkspaceStore } = require("../dist/storage/workspaceStore.js");

  const sourceFilePath = path.join(process.cwd(), "src", "providers", "localProvider.ts");
  const sourceCode = fs.readFileSync(sourceFilePath, "utf8");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");
  const candidatePool = buildPreprocessCandidatePool(glossaryEntries);
  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "rcic-smoke-preprocess-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();

  try {
    const settings = {
      autoExplainEnabled: false,
      autoExplainDelayMs: 600,
      autoOpenPanel: true,
      providerId: "openai-compatible",
      providerBaseUrl,
      providerModel,
      providerApiKeyEnvVar,
      providerFallbacks: (() => {
        try {
          return JSON.parse(
            process.env.READ_CODE_IN_CHINESE_PROVIDER_FALLBACKS || "[]"
          );
        } catch {
          return [];
        }
      })(),
      providerTimeoutMs: Number(
        process.env.READ_CODE_IN_CHINESE_PROVIDER_TIMEOUT_MS || 60000
      ),
      providerTemperature: Number(
        process.env.READ_CODE_IN_CHINESE_PROVIDER_TEMPERATURE || 0.2
      ),
      providerTopP: Number(process.env.READ_CODE_IN_CHINESE_PROVIDER_TOP_P || 1),
      providerMaxTokens: Number(
        process.env.READ_CODE_IN_CHINESE_PROVIDER_MAX_TOKENS || 1200
      ),
      providerReasoningEffort: "medium",
      detailLevel: "balanced",
      professionalLevel: "intermediate",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "Verify remote file wordbook preprocessing.",
      knowledgeTopK: 3,
      customInstructions:
        process.env.READ_CODE_IN_CHINESE_PROMPT_CUSTOM_INSTRUCTIONS || "",
      preprocessIncludeAllCandidates: true
    };
    const provider = new OpenAICompatibleProvider(settings);
    const result = await buildSymbolPreprocessCache({
      editorText: sourceCode,
      languageId: "typescript",
      filePath: sourceFilePath,
      relativeFilePath: "src/providers/localProvider.ts",
      settings,
      glossaryEntries,
      candidatePool,
      workspaceStore: store,
      provider
    });

    if (!result) {
      throw new Error("Preprocess builder returned no result.");
    }

    if (result.source !== "openai-compatible" || !result.verifiedRemoteInference) {
      throw new Error("Remote preprocess smoke did not verify remote inference.");
    }

    if (result.cacheFile.entries.length !== candidatePool.length) {
      throw new Error(
        `Expected ${candidatePool.length} cached entries, got ${result.cacheFile.entries.length}.`
      );
    }

    console.log(
      JSON.stringify(
        {
          source: result.source,
          verifiedRemoteInference: result.verifiedRemoteInference,
          selectionMode: result.selectionMode,
          candidatePoolCount: candidatePool.length,
          cachedEntryCount: result.cacheFile.entries.length
        },
        null,
        2
      )
    );
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
