import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "fs";
import { createServer } from "http";
import type { AddressInfo } from "net";
import * as os from "os";
import * as path from "path";
import {
  buildPreprocessCandidatePool,
  buildPreprocessCandidates,
  getPreprocessTargetSelectionCount
} from "../analysis/preprocess";
import { extractGlossaryEntries } from "../analysis/glossary";
import { attachWordbookScopePaths } from "../analysis/wordbook";
import {
  buildFileOverviewSummary,
  createWorkspaceFileSummary,
  inferGranularity
} from "../analysis/summary";
import { getOfficialDocsPreset } from "../knowledge/officialDocs";
import { KnowledgeStore } from "../knowledge/knowledgeStore";
import { PreprocessStore } from "../knowledge/preprocessStore";
import {
  buildCachedPreprocessExplanation,
  buildSymbolPreprocessCache
} from "../knowledge/symbolPreprocessBuilder";
import { TokenKnowledgeStore } from "../knowledge/tokenKnowledgeStore";
import {
  generateGlobalPrompt,
  generatePreprocessAudiencePrompt
} from "../prompts/globalPromptProfile";
import { buildExplainPrompts } from "../prompts/openAICompatiblePrompt";
import { LocalExplanationProvider } from "../providers/localProvider";
import { OpenAICompatibleProvider } from "../providers/openAICompatibleProvider";
import { WorkspaceStore } from "../storage/workspaceStore";
import { createContentHash } from "../utils/hash";
import {
  ExtensionSettings,
  ExplanationRequest,
  PreprocessedSymbolEntry,
  PreprocessProgress,
  SymbolPreprocessRequest
} from "../contracts";

function createRemoteSettings(
  overrides: Partial<ExtensionSettings> = {}
): ExtensionSettings {
  return {
    autoExplainEnabled: false,
    autoExplainDelayMs: 600,
    autoOpenPanel: true,
    providerId: "openai-compatible",
    providerBaseUrl: "https://example.com/v1",
    providerModel: "gpt-5.4",
    providerApiKeyEnvVar: "READ_CODE_IN_CHINESE_API_KEY",
    providerFallbacks: [],
    providerTimeoutMs: 20000,
    providerTemperature: 0.2,
    providerTopP: 1,
    providerMaxTokens: 1200,
    providerReasoningEffort: "medium",
    detailLevel: "balanced",
    professionalLevel: "intermediate",
    occupation: "developer",
    sections: ["summary", "usage"],
    userGoal: "",
    knowledgeTopK: 3,
    customInstructions: "",
    preprocessIncludeAllCandidates: true,
    ...overrides
  };
}

test("extractGlossaryEntries finds key symbols", () => {
  const sourceCode = [
    "import fetchUser from './api';",
    "const userCount = users.length;",
    "function loadUsers(userId) {",
    "  return fetchUser(userId);",
    "}"
  ].join("\n");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");

  assert.ok(glossaryEntries.some((entry) => entry.term === "userCount"));
  assert.ok(glossaryEntries.some((entry) => entry.term === "loadUsers"));
});

test("extractGlossaryEntries includes custom function definitions beyond plain declarations", () => {
  const sourceCode = [
    "const buildVector = (input) => input;",
    "const normalizeData = async function(value) { return value; };",
    "const handlers = {",
    "  retryFailed(term) { return term; },",
    "  flushQueue: (items) => items",
    "};",
    "class Service {",
    "  computeScore(sample) { return sample; }",
    "}"
  ].join("\n");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");

  assert.ok(glossaryEntries.some((entry) => entry.term === "buildVector" && entry.category === "function"));
  assert.ok(glossaryEntries.some((entry) => entry.term === "normalizeData" && entry.category === "function"));
  assert.ok(glossaryEntries.some((entry) => entry.term === "retryFailed" && entry.category === "function"));
  assert.ok(glossaryEntries.some((entry) => entry.term === "flushQueue" && entry.category === "function"));
  assert.ok(glossaryEntries.some((entry) => entry.term === "computeScore" && entry.category === "function"));
});

test("extractGlossaryEntries includes python variables and label strings", () => {
  const sourceCode = [
    "class_names = ['PCA', 'ICA']",
    "feature_map = build_map(data)",
    "self.hidden_size = 128"
  ].join("\n");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "python");

  assert.ok(glossaryEntries.some((entry) => entry.term === "feature_map"));
  assert.ok(glossaryEntries.some((entry) => entry.term === "hidden_size"));
  assert.ok(glossaryEntries.some((entry) => entry.term === "PCA" && entry.category === "label"));
});

test("extractGlossaryEntries includes python member function references", () => {
  const sourceCode = [
    "class SpectralNet:",
    "    def squeeze(self, x):",
    "        return x",
    "",
    "    def forward(self, x):",
    "        return self.squeeze(x)"
  ].join("\n");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "python");

  assert.ok(glossaryEntries.some((entry) => entry.term === "squeeze" && entry.category === "function"));
  assert.ok(glossaryEntries.some((entry) => entry.term === "forward" && entry.category === "function"));
});

test("attachWordbookScopePaths groups entries by class and function scope", () => {
  const sourceCode = [
    "class SpectralNet:",
    "    def __init__(self):",
    "        self.hidden_size = 128",
    "",
    "    def squeeze(self, x):",
    "        return x",
    "",
    "    def forward(self, x):",
    "        return self.squeeze(x)",
    "",
    "def build_model():",
    "    return SpectralNet()"
  ].join("\n");
  const entries: PreprocessedSymbolEntry[] = attachWordbookScopePaths(
    [
      {
        term: "hidden_size",
        normalizedTerm: "hidden_size",
        category: "variable",
        sourceLine: 3,
        summary: "hidden size",
        generatedAt: new Date().toISOString()
      },
      {
        term: "squeeze",
        normalizedTerm: "squeeze",
        category: "function",
        sourceLine: 5,
        summary: "squeeze method",
        generatedAt: new Date().toISOString()
      },
      {
        term: "build_model",
        normalizedTerm: "build_model",
        category: "function",
        sourceLine: 11,
        summary: "build model",
        generatedAt: new Date().toISOString()
      }
    ] satisfies PreprocessedSymbolEntry[],
    sourceCode,
    "python"
  );

  assert.deepEqual(entries[0].scopePath, ["class SpectralNet", "function __init__"]);
  assert.deepEqual(entries[1].scopePath, ["class SpectralNet", "function squeeze"]);
  assert.deepEqual(entries[2].scopePath, ["function build_model"]);
});

test("inferGranularity distinguishes token, function, and block", () => {
  assert.equal(inferGranularity("userCount", 1), "token");
  assert.equal(inferGranularity("function loadUsers(id) { return id; }", 1), "function");
  assert.equal(inferGranularity("if (ready) {\n  run();\n}", 3), "block");
});

test("workspace file summary produces a concise overview", () => {
  const summary = createWorkspaceFileSummary(
    "src/example.ts",
    "typescript",
    "export function buildSummary() { return true; }"
  );

  assert.equal(summary.path, "src/example.ts");
  assert.ok(summary.summary.includes("src/example.ts"));
  assert.ok(summary.tags.includes("public-api"));
});

test("local provider returns structured explanation output", async () => {
  const provider = new LocalExplanationProvider();
  const request: ExplanationRequest = {
    requestId: "test",
    reason: "manual",
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    selectedText: "function loadUsers(userId) { return fetchUser(userId); }",
    selectionPreview: "[[function loadUsers(userId) { return fetchUser(userId); }]]",
    granularity: "function",
    detailLevel: "balanced",
    occupation: "developer",
    professionalLevel: "intermediate",
    sections: ["summary", "inputOutput", "usage"],
    userGoal: "Understand the function quickly",
    customInstructions: "",
    contextBefore: "",
    contextAfter: "",
    glossaryEntries: extractGlossaryEntries(
      "const userId = 1; function loadUsers(userId) { return fetchUser(userId); }",
      "typescript"
    ),
    knowledgeSnippets: []
  };
  const response = await provider.explain(request);

  assert.equal(response.requestId, "test");
  assert.equal(response.granularity, "function");
  assert.ok(response.sections.length >= 3);
});

test("file overview mentions the target file", () => {
  const summary = buildFileOverviewSummary(
    "export const ready = true;",
    "src/state.ts"
  );

  assert.ok(summary.includes("src/state.ts"));
});

test("official docs preset exists for typescript", () => {
  const preset = getOfficialDocsPreset("typescript");

  assert.ok(preset);
  assert.equal(preset?.label, "TypeScript");
  assert.ok((preset?.documents.length ?? 0) >= 2);
});

test("knowledge search prefers title matches", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-knowledge-search-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const knowledgeStore = new KnowledgeStore(store);

  await knowledgeStore.upsertDocuments([
    {
      id: "doc-1",
      title: "Promise handling",
      sourcePath: "doc-1",
      importedAt: new Date().toISOString(),
      tags: ["javascript"],
      content: "Promise chains and async flow.",
      sourceType: "imported"
    },
    {
      id: "doc-2",
      title: "Misc notes",
      sourcePath: "doc-2",
      importedAt: new Date().toISOString(),
      tags: ["javascript", "promise"],
      content: "This note briefly mentions promise once.",
      sourceType: "imported"
    }
  ]);

  const results = await knowledgeStore.search("promise", 2);

  assert.equal(results[0]?.documentId, "doc-1");
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("preprocess candidate builder focuses on user-defined symbols", () => {
  const glossaryEntries = extractGlossaryEntries(
    [
      "import torch from 'torch';",
      "const n = values.length;",
      "const featureMap = buildFeatureMap(values);",
      "function buildFeatureMap(input) { return input; }",
      "function forward(input) { return input; }",
      "function transform(features) { return features; }",
      "function render(view) { return view; }",
      "function train(batch) { return batch; }",
      "const data = loadData();",
      "const result = buildResult(data);",
      "const item = result[0];",
      "const classNames = ['PCA', 'ICA'];",
      "class EmbeddingModel {}"
    ].join("\n"),
    "typescript"
  );

  const beginner = buildPreprocessCandidates(glossaryEntries, "beginner", "student");
  const intermediate = buildPreprocessCandidates(glossaryEntries, "intermediate", "developer");
  const expert = buildPreprocessCandidates(glossaryEntries, "expert", "developer");

  assert.ok(beginner.some((entry) => entry.term === "featureMap"));
  assert.ok(beginner.some((entry) => entry.term === "buildFeatureMap"));
  assert.ok(beginner.some((entry) => entry.term === "PCA"));
  assert.ok(!beginner.some((entry) => entry.term === "torch"));
  assert.equal(beginner.length, buildPreprocessCandidatePool(glossaryEntries).length);
  assert.equal(
    intermediate.length,
    getPreprocessTargetSelectionCount(buildPreprocessCandidatePool(glossaryEntries).length, "intermediate")
  );
  assert.equal(
    expert.length,
    getPreprocessTargetSelectionCount(buildPreprocessCandidatePool(glossaryEntries).length, "expert")
  );
  assert.ok(beginner.length >= intermediate.length);
  assert.ok(intermediate.length >= expert.length);
  assert.ok(intermediate.some((entry) => entry.term === "featureMap"));
  assert.ok(expert.some((entry) => entry.term === "buildFeatureMap"));
});

test("preprocess store reads back file-scoped cache entries", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-preprocess-store-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const preprocessStore = new PreprocessStore(store);

  await preprocessStore.write("src/example.ts", {
    languageId: "typescript",
    relativeFilePath: "src/example.ts",
    sourceHash: "hash-1",
    generatedAt: new Date().toISOString(),
    entries: [
      {
        term: "featureMap",
        normalizedTerm: "featuremap",
        category: "variable",
        sourceLine: 3,
        summary: "Stores the processed feature mapping.",
        generatedAt: new Date().toISOString()
      }
    ]
  });

  const cached = await preprocessStore.findEntry("src/example.ts", "hash-1", "featureMap");

  assert.equal(cached?.summary, "Stores the processed feature mapping.");
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("symbol preprocess builder writes batch results into file cache", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-symbol-preprocess-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const sourceCode = [
    "const featureMap = buildFeatureMap(values);",
    "function buildFeatureMap(input) { return input; }",
    "class EmbeddingModel {}"
  ].join("\n");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");
  const provider = {
    id: "openai-compatible",
    async explain() {
      throw new Error("unused");
    },
    async answerFollowUp() {
      return {
        answer: "unused",
        suggestedQuestions: [],
        source: "openai-compatible",
        latencyMs: 1
      };
    },
    async selectPreprocessCandidates(request: { requestId: string; languageId: string }) {
      return {
        requestId: request.requestId,
        languageId: request.languageId,
        selectedTerms: ["featureMap", "EmbeddingModel"],
        source: "openai-compatible",
        latencyMs: 8
      };
    },
    async preprocessSymbols(request: SymbolPreprocessRequest) {
      return {
        requestId: request.requestId,
        languageId: request.languageId,
        source: "openai-compatible",
        latencyMs: 20,
        entries: request.candidates.map((candidate) => ({
          term: candidate.term,
          normalizedTerm: candidate.normalizedTerm,
          category: candidate.category,
          sourceLine: candidate.sourceLine,
          summary: candidate.term + " summary",
          generatedAt: new Date().toISOString()
        }))
      };
    }
  };

  const progressSnapshots: string[] = [];
  const result = await buildSymbolPreprocessCache({
    editorText: sourceCode,
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    settings: {
      autoExplainEnabled: false,
      autoExplainDelayMs: 600,
      autoOpenPanel: true,
      providerId: "openai-compatible",
      providerBaseUrl: "https://example.com/v1",
      providerModel: "gpt-5.4",
      providerApiKeyEnvVar: "READ_CODE_IN_CHINESE_API_KEY",
      providerFallbacks: [],
      providerTimeoutMs: 20000,
      providerTemperature: 0.2,
      providerTopP: 1,
      providerMaxTokens: 1200,
      providerReasoningEffort: "medium",
      detailLevel: "balanced",
      professionalLevel: "intermediate",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessIncludeAllCandidates: true
    },
    glossaryEntries,
    workspaceStore: store,
    provider,
    onProgress: (progress: PreprocessProgress) => {
      progressSnapshots.push(progress.status + ":" + progress.completedSteps);
    }
  });

  const preprocessStore = new PreprocessStore(store);
  const cached = await preprocessStore.read("src/example.ts");

  assert.ok(result);
  assert.deepEqual(
    result?.candidates.map((candidate) => candidate.term).sort(),
    ["EmbeddingModel", "buildFeatureMap", "featureMap"]
  );
  assert.equal(cached?.entries.length ?? 0, 3);
  assert.equal(cached?.candidateStates?.length ?? 0, 3);
  assert.ok(cached?.candidateStates?.every((candidateState) => candidateState.status === "succeeded"));
  assert.ok(cached?.entries.some((entry) => entry.summary === "featureMap summary"));
  assert.ok(progressSnapshots.includes("completed:5"));
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("symbol preprocess builder processes wordbook entries in chunks", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-symbol-preprocess-chunks-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const sourceCode = "export const ready = true;";
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");
  const candidatePool = Array.from({ length: 46 }, (_, index) => ({
    term: `symbol_${index}`,
    normalizedTerm: `symbol_${index}`,
    category: index % 2 === 0 ? "variable" : "function",
    sourceLine: index + 1,
    references: 2,
    score: 100 - index
  })) satisfies ReturnType<typeof buildPreprocessCandidatePool>;
  const preprocessBatchSizes: number[] = [];
  const provider = {
    id: "openai-compatible",
    async explain() {
      throw new Error("unused");
    },
    async answerFollowUp() {
      return {
        answer: "unused",
        suggestedQuestions: [],
        source: "openai-compatible",
        latencyMs: 1
      };
    },
    async selectPreprocessCandidates(request: {
      requestId: string;
      languageId: string;
      candidatePool: Array<{ term: string }>;
    }) {
      return {
        requestId: request.requestId,
        languageId: request.languageId,
        selectedTerms: request.candidatePool.map((candidate) => candidate.term),
        source: "openai-compatible",
        latencyMs: 8
      };
    },
    async preprocessSymbols(request: SymbolPreprocessRequest) {
      preprocessBatchSizes.push(request.candidates.length);

      return {
        requestId: request.requestId,
        languageId: request.languageId,
        source: "openai-compatible",
        latencyMs: 20,
        entries: request.candidates.map((candidate) => ({
          term: candidate.term,
          normalizedTerm: candidate.normalizedTerm,
          category: candidate.category,
          sourceLine: candidate.sourceLine,
          summary: candidate.term + " summary",
          generatedAt: new Date().toISOString()
        }))
      };
    }
  };

  const progressSnapshots: Array<{
    batchCount: number;
    processedBatches?: number;
    currentStep?: string;
    candidateStateCount: number;
    pendingCount: number;
  }> = [];
  const result = await buildSymbolPreprocessCache({
    editorText: sourceCode,
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    settings: {
      autoExplainEnabled: false,
      autoExplainDelayMs: 600,
      autoOpenPanel: true,
      providerId: "openai-compatible",
      providerBaseUrl: "https://example.com/v1",
      providerModel: "gpt-5.4",
      providerApiKeyEnvVar: "READ_CODE_IN_CHINESE_API_KEY",
      providerFallbacks: [],
      providerTimeoutMs: 20000,
      providerTemperature: 0.2,
      providerTopP: 1,
      providerMaxTokens: 1200,
      providerReasoningEffort: "medium",
      detailLevel: "balanced",
      professionalLevel: "beginner",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessIncludeAllCandidates: true
    },
    glossaryEntries,
    candidatePool,
    workspaceStore: store,
    provider,
    onProgress: (progress: PreprocessProgress) => {
      progressSnapshots.push({
        batchCount: progress.batchCount,
        processedBatches: progress.processedBatches,
        currentStep: progress.currentStep,
        candidateStateCount: progress.candidateStates?.length ?? 0,
        pendingCount:
          progress.candidateStates?.filter((candidateState) => candidateState.status === "pending")
            .length ?? 0
      });
    }
  });

  assert.ok(result);
  assert.equal(preprocessBatchSizes.length, 3);
  assert.deepEqual(preprocessBatchSizes, [20, 20, 6]);
  assert.ok(
    progressSnapshots.some(
      (snapshot) =>
        snapshot.currentStep === "Selected wordbook terms" &&
        snapshot.candidateStateCount === 46 &&
        snapshot.pendingCount === 46
    )
  );
  assert.ok(progressSnapshots.some((snapshot) => snapshot.batchCount === 3));
  assert.ok(progressSnapshots.some((snapshot) => snapshot.processedBatches === 3));
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("symbol preprocess builder ignores placeholder cache entries", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-symbol-preprocess-placeholders-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const sourceCode = [
    "const featureMap = buildFeatureMap(values);",
    "function buildFeatureMap(input) { return input; }"
  ].join("\n");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");
  const preprocessStore = new PreprocessStore(store);
  const sourceHash = createContentHash(sourceCode);
  await preprocessStore.write("src/example.ts", {
    languageId: "typescript",
    relativeFilePath: "src/example.ts",
    sourceHash,
    generatedAt: new Date().toISOString(),
    entries: [
      {
        term: "featureMap",
        normalizedTerm: "featuremap",
        category: "variable",
        sourceLine: 1,
        summary: "`featureMap` 是当前文件中的变量，作用需要结合附近代码继续确认。",
        generatedAt: new Date().toISOString(),
        isPlaceholder: true
      }
    ]
  });

  let preprocessCalls = 0;
  const provider = {
    id: "openai-compatible",
    async explain() {
      throw new Error("unused");
    },
    async answerFollowUp() {
      return {
        answer: "unused",
        suggestedQuestions: [],
        source: "openai-compatible",
        latencyMs: 1
      };
    },
    async selectPreprocessCandidates(request: {
      requestId: string;
      languageId: string;
      candidatePool: Array<{ term: string }>;
    }) {
      return {
        requestId: request.requestId,
        languageId: request.languageId,
        selectedTerms: request.candidatePool.map((candidate) => candidate.term),
        source: "openai-compatible",
        latencyMs: 8
      };
    },
    async preprocessSymbols(request: SymbolPreprocessRequest) {
      preprocessCalls += 1;

      return {
        requestId: request.requestId,
        languageId: request.languageId,
        source: "openai-compatible",
        latencyMs: 20,
        entries: request.candidates.map((candidate) => ({
          term: candidate.term,
          normalizedTerm: candidate.normalizedTerm,
          category: candidate.category,
          sourceLine: candidate.sourceLine,
          summary: candidate.term + " summary",
          generatedAt: new Date().toISOString()
        }))
      };
    }
  };

  const result = await buildSymbolPreprocessCache({
    editorText: sourceCode,
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    settings: {
      autoExplainEnabled: false,
      autoExplainDelayMs: 600,
      autoOpenPanel: true,
      providerId: "openai-compatible",
      providerBaseUrl: "https://example.com/v1",
      providerModel: "gpt-5.4",
      providerApiKeyEnvVar: "READ_CODE_IN_CHINESE_API_KEY",
      providerFallbacks: [],
      providerTimeoutMs: 20000,
      providerTemperature: 0.2,
      providerTopP: 1,
      providerMaxTokens: 1200,
      providerReasoningEffort: "medium",
      detailLevel: "balanced",
      professionalLevel: "beginner",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessIncludeAllCandidates: true
    },
    glossaryEntries,
    workspaceStore: store,
    provider
  });

  assert.ok(result);
  assert.equal(preprocessCalls, 1);
  assert.ok(result.cacheFile.entries.every((entry) => !entry.isPlaceholder));
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("cached preprocess explanation returns quick token summary", () => {
  const request: ExplanationRequest = {
    requestId: "quick",
    reason: "manual",
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    selectedText: "featureMap",
    selectionPreview: "const [[featureMap]] = buildFeatureMap(values);",
    granularity: "token",
    detailLevel: "balanced",
    occupation: "developer",
    professionalLevel: "intermediate",
    sections: ["summary"],
    userGoal: "",
    customInstructions: "",
    contextBefore: "",
    contextAfter: "",
    glossaryEntries: [
      {
        term: "featureMap",
        normalizedTerm: "featuremap",
        meaning: "Variable that represents feature map.",
        category: "variable",
        references: 2,
        source: "generated",
        updatedAt: new Date().toISOString(),
        sourceLine: 1
      }
    ],
    knowledgeSnippets: []
  };

  const response = buildCachedPreprocessExplanation(request, {
    term: "featureMap",
    normalizedTerm: "featuremap",
    category: "variable",
    sourceLine: 1,
    summary: "保存当前文件里构建好的特征映射结果。",
    generatedAt: new Date().toISOString()
  });

  assert.equal(response.source, "preprocess-cache");
  assert.equal(response.summary, "保存当前文件里构建好的特征映射结果。");
  assert.deepEqual(response.sections[0]?.items, ["保存当前文件里构建好的特征映射结果。"]);
});

test("token knowledge store still reads back remote token cache", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-token-knowledge-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const tokenStore = new TokenKnowledgeStore(store);

  await tokenStore.upsert("python", "squeeze", {
    requestId: "token-cache",
    title: "squeeze",
    summary: "squeeze is a tensor method.",
    sections: [
      {
        label: "summary",
        content: "Removes dimensions of size 1."
      }
    ],
    suggestedQuestions: [],
    glossaryHints: [],
    granularity: "token",
    selectionText: "squeeze",
    source: "openai-compatible",
    latencyMs: 10,
    knowledgeUsed: []
  });

  const cached = await tokenStore.find("python", "squeeze");

  assert.equal(cached?.normalizedTerm, "squeeze");
  assert.equal(cached?.explanation.summary, "squeeze is a tensor method.");
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("global prompt generator reflects audience profile", () => {
  const prompt = generateGlobalPrompt({
    occupation: "student",
    professionalLevel: "beginner",
    detailLevel: "balanced",
    userGoal: "Understand ML training code"
  });

  assert.match(prompt, /teaching-style/i);
  assert.match(prompt, /Understand ML training code/);
});

test("preprocess prompt generator ignores explanation sections", () => {
  const prompt = generatePreprocessAudiencePrompt({
    occupation: "student",
    professionalLevel: "beginner",
    detailLevel: "balanced",
    userGoal: "Build a quick wordbook for this file"
  });

  assert.match(prompt, /one short sentence per symbol/i);
  assert.match(prompt, /do not expand into sections/i);
  assert.doesNotMatch(prompt, /summary, usage/i);
});

test("token explain prompt includes selection preview and glossary hints", () => {
  const prompts = buildExplainPrompts({
    requestId: "token-prompt",
    reason: "manual",
    languageId: "python",
    filePath: "D:/workspace/model.py",
    relativeFilePath: "model.py",
    selectedText: "squeeze",
    selectionPreview: "y = x.[[squeeze]](0)",
    granularity: "token",
    detailLevel: "balanced",
    occupation: "data-scientist",
    professionalLevel: "intermediate",
    sections: ["summary", "usage"],
    userGoal: "Understand tensor ops",
    customInstructions: "Prefer exact API meanings.",
    contextBefore: "x = model_output",
    contextAfter: "(0)",
    glossaryEntries: [
      {
        term: "x",
        normalizedTerm: "x",
        meaning: "Model output tensor.",
        category: "variable",
        references: 3,
        source: "generated",
        updatedAt: new Date().toISOString()
      }
    ],
    knowledgeSnippets: []
  });

  assert.match(prompts.user, /Selection line preview:/);
  assert.match(prompts.user, /Occupation: data-scientist/);
  assert.match(prompts.user, /Professional level: intermediate/);
  assert.match(prompts.user, /y = x\.\[\[squeeze\]\]\(0\)/);
  assert.match(prompts.user, /Glossary hints:/);
  assert.match(prompts.system, /concrete API usage/i);
  assert.match(prompts.system, /tensor, feature, shape, pipeline/i);
});

test("local prompt generator keeps dictionary-style guidance", async () => {
  const provider = new LocalExplanationProvider();
  const response = await provider.generatePromptProfile({
    occupation: "developer",
    professionalLevel: "intermediate",
    detailLevel: "balanced",
    sections: ["summary", "usage"],
    userGoal: "Understand model inference code",
    reasoningEffort: "medium",
    temperature: 0.2,
    topP: 1,
    maxTokens: 900
  });

  assert.equal(response.source, "local");
  assert.match(response.prompt, /dictionary-like style/i);
  assert.match(response.prompt, /Understand model inference code/);
});

test("openai provider normalizes preprocess candidate selections", async () => {
  const originalFetch = globalThis.fetch;
  process.env.TEST_OPENAI_PROVIDER_KEY = "test-key";
  const glossaryEntries = extractGlossaryEntries(
    [
      "const featureMap = buildFeatureMap(values);",
      "function buildFeatureMap(input) { return input; }",
      "class EmbeddingModel {}"
    ].join("\n"),
    "typescript"
  );

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                selectedTerms: [
                  "featureMap",
                  "missingTerm",
                  { term: "EmbeddingModel" },
                  "featureMap"
                ]
              })
            }
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )) as unknown as typeof fetch;

  try {
    const provider = new OpenAICompatibleProvider({
      autoExplainEnabled: false,
      autoExplainDelayMs: 600,
      autoOpenPanel: true,
      providerId: "openai-compatible",
      providerBaseUrl: "https://example.com/v1",
      providerModel: "gpt-5.4",
      providerApiKeyEnvVar: "TEST_OPENAI_PROVIDER_KEY",
      providerFallbacks: [],
      providerTimeoutMs: 1000,
      providerTemperature: 0.2,
      providerTopP: 1,
      providerMaxTokens: 1200,
      providerReasoningEffort: "medium",
      detailLevel: "balanced",
      professionalLevel: "intermediate",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessIncludeAllCandidates: true
    });
    const candidatePool = buildPreprocessCandidatePool(glossaryEntries);
    const response = await provider.selectPreprocessCandidates!({
      requestId: "remote-select",
      languageId: "typescript",
      filePath: "D:/workspace/src/example.ts",
      relativeFilePath: "src/example.ts",
      professionalLevel: "intermediate",
      occupation: "developer",
      sourceCode: [
        "const featureMap = buildFeatureMap(values);",
        "function buildFeatureMap(input) { return input; }",
        "class EmbeddingModel {}"
      ].join("\n"),
      candidatePool,
      targetSelectionCount: 2,
      retentionRatio: 0.85,
      userGoal: "",
      customInstructions: ""
    });

    assert.equal(response.source, "openai-compatible");
    assert.deepEqual(response.selectedTerms, ["featureMap", "EmbeddingModel"]);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.TEST_OPENAI_PROVIDER_KEY;
  }
});

test("openai provider normalizes section items from remote json", async () => {
  const originalFetch = globalThis.fetch;
  process.env.TEST_OPENAI_PROVIDER_KEY = "test-key";

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Tensor Call",
                summary: "解释成功。",
                sections: [
                  {
                    label: "usage",
                    content: "删除长度为 1 的维度。 常见于整理 tensor 形状。"
                  }
                ],
                suggestedQuestions: [],
                glossaryHints: []
              })
            }
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )) as unknown as typeof fetch;

  try {
    const provider = new OpenAICompatibleProvider({
      autoExplainEnabled: false,
      autoExplainDelayMs: 600,
      autoOpenPanel: true,
      providerId: "openai-compatible",
      providerBaseUrl: "https://example.com/v1",
      providerModel: "gpt-5.4",
      providerApiKeyEnvVar: "TEST_OPENAI_PROVIDER_KEY",
      providerFallbacks: [],
      providerTimeoutMs: 1000,
      providerTemperature: 0.2,
      providerTopP: 1,
      providerMaxTokens: 1200,
      providerReasoningEffort: "medium",
      detailLevel: "balanced",
      professionalLevel: "intermediate",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessIncludeAllCandidates: true
    });
    const response = await provider.explain({
      requestId: "remote-json",
      reason: "manual",
      languageId: "python",
      filePath: "D:/workspace/model.py",
      relativeFilePath: "model.py",
      selectedText: "squeeze",
      selectionPreview: "x = tensor.[[squeeze]](0)",
      granularity: "token",
      detailLevel: "balanced",
      occupation: "developer",
      professionalLevel: "intermediate",
      sections: ["summary", "usage"],
      userGoal: "",
      customInstructions: "",
      contextBefore: "tensor = output",
      contextAfter: "",
      glossaryEntries: [],
      knowledgeSnippets: []
    });

    assert.equal(response.source, "openai-compatible");
    assert.equal(response.sections[0]?.label, "usage");
    assert.deepEqual(response.sections[0]?.items, [
      "删除长度为 1 的维度。",
      "常见于整理 tensor 形状。"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.TEST_OPENAI_PROVIDER_KEY;
  }
});

test("openai provider retries fallback endpoints when the primary endpoint fails", async () => {
  const originalFetch = globalThis.fetch;
  process.env.TEST_OPENAI_PROVIDER_KEY = "primary-key";
  process.env.TEST_OPENAI_PROVIDER_KEY_FALLBACK = "fallback-key";
  const requestedUrls: string[] = [];

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.startsWith("https://primary.example.com")) {
      return new Response("primary failed", {
        status: 500,
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Fallback Success",
                summary: "备用接口返回成功。",
                sections: [],
                suggestedQuestions: [],
                glossaryHints: []
              })
            }
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }) as unknown as typeof fetch;

  try {
    const provider = new OpenAICompatibleProvider(
      createRemoteSettings({
        providerBaseUrl: "https://primary.example.com/v1",
        providerApiKeyEnvVar: "TEST_OPENAI_PROVIDER_KEY",
        providerFallbacks: [
          {
            baseUrl: "https://fallback.example.com/v1",
            model: "gpt-5.4",
            apiKeyEnvVar: "TEST_OPENAI_PROVIDER_KEY_FALLBACK"
          }
        ],
        providerTimeoutMs: 1000
      })
    );
    const response = await provider.explain({
      requestId: "fallback-explain",
      reason: "manual",
      languageId: "typescript",
      filePath: "D:/workspace/src/example.ts",
      relativeFilePath: "src/example.ts",
      selectedText: "featureMap",
      selectionPreview: "const [[featureMap]] = buildFeatureMap(values);",
      granularity: "token",
      detailLevel: "balanced",
      occupation: "developer",
      professionalLevel: "intermediate",
      sections: ["summary"],
      userGoal: "",
      customInstructions: "",
      contextBefore: "",
      contextAfter: "",
      glossaryEntries: [],
      knowledgeSnippets: []
    });

    assert.equal(response.source, "openai-compatible");
    assert.equal(response.summary, "备用接口返回成功。");
    assert.ok(requestedUrls.some((url) => url.startsWith("https://primary.example.com")));
    assert.ok(requestedUrls.some((url) => url.startsWith("https://fallback.example.com")));
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.TEST_OPENAI_PROVIDER_KEY;
    delete process.env.TEST_OPENAI_PROVIDER_KEY_FALLBACK;
  }
});

test("symbol preprocess smoke uses full file context and verifies remote inference", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-symbol-preprocess-smoke-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const sourceFilePath = path.join(process.cwd(), "src", "providers", "localProvider.ts");
  const sourceCode = await fs.readFile(sourceFilePath, "utf8");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");
  const candidatePool = buildPreprocessCandidatePool(glossaryEntries);
  const requestBodies: Array<Record<string, unknown>> = [];
  process.env.TEST_OPENAI_PROVIDER_KEY = "smoke-key";

  const server = createServer(async (req, res) => {
    let body = "";

    for await (const chunk of req) {
      body += chunk;
    }

    const payload = JSON.parse(body) as Record<string, unknown>;
    requestBodies.push(payload);
    const messages = Array.isArray(payload.messages)
      ? (payload.messages as Array<{ content?: string }>)
      : [];
    const userPrompt = messages[1]?.content ?? "";
    const terms = Array.from(
      userPrompt.matchAll(/^- (.+?) \| category=/gm),
      (match) => match[1]
    );
    const entries = terms.map((term) => ({
      term,
      summary: `${term} remote summary`
    }));

    res.writeHead(200, {
      "Content-Type": "application/json"
    });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                entries
              })
            }
          }
        ]
      })
    );
  });

  try {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    const settings = createRemoteSettings({
      providerBaseUrl: `http://127.0.0.1:${address.port}/v1`,
      providerModel: "mock-gpt-5.4",
      providerApiKeyEnvVar: "TEST_OPENAI_PROVIDER_KEY",
      providerTimeoutMs: 2000
    });
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

    assert.ok(candidatePool.length > 0);
    assert.ok(result);
    assert.equal(result?.source, "openai-compatible");
    assert.equal(result?.selectionMode, "all-candidates");
    assert.equal(result?.selectionSource, "all-candidates");
    assert.equal(result?.verifiedRemoteInference, true);
    assert.equal(result?.candidates.length, candidatePool.length);
    assert.equal(result?.cacheFile.entries.length, candidatePool.length);
    assert.equal(result?.cacheFile.selectionMode, "all-candidates");
    assert.equal(result?.cacheFile.selectedCandidateCount, candidatePool.length);
    assert.equal(result?.cacheFile.verifiedRemoteInference, true);
    assert.ok(requestBodies.length >= 1);
    assert.equal(requestBodies[0]?.model, "mock-gpt-5.4");
    const firstPrompt = String(
      ((requestBodies[0]?.messages as Array<{ content?: string }> | undefined)?.[1]?.content ??
        "")
    );
    assert.match(firstPrompt, /Full file context:/);
    assert.match(firstPrompt, /class LocalExplanationProvider/);
  } finally {
    server.close();
    delete process.env.TEST_OPENAI_PROVIDER_KEY;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("symbol preprocess builder records failed candidates for incomplete remote responses", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-symbol-preprocess-incomplete-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const sourceCode = [
    "const featureMap = buildFeatureMap(values);",
    "function buildFeatureMap(input) { return input; }",
    "class EmbeddingModel {}"
  ].join("\n");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");
  const candidatePool = buildPreprocessCandidatePool(glossaryEntries);
  const provider = {
    id: "openai-compatible",
    async explain() {
      throw new Error("unused");
    },
    async answerFollowUp() {
      return {
        answer: "unused",
        suggestedQuestions: [],
        source: "openai-compatible",
        latencyMs: 1
      };
    },
    async preprocessSymbols(request: SymbolPreprocessRequest) {
      return {
        requestId: request.requestId,
        languageId: request.languageId,
        source: "openai-compatible",
        latencyMs: 20,
        entries: request.candidates.slice(0, 1).map((candidate) => ({
          term: candidate.term,
          normalizedTerm: candidate.normalizedTerm,
          category: candidate.category,
          sourceLine: candidate.sourceLine,
          summary: candidate.term + " summary",
          generatedAt: new Date().toISOString()
        }))
      };
    }
  };

  const result = await buildSymbolPreprocessCache({
    editorText: sourceCode,
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    settings: createRemoteSettings(),
    glossaryEntries,
    candidatePool,
    workspaceStore: store,
    provider
  });

  assert.ok(result);
  assert.equal(result?.cacheFile.entries.length, 0);
  assert.equal(result?.failedCandidateCount, candidatePool.length);
  assert.equal(result?.verifiedRemoteInference, false);
  assert.ok(result?.cacheFile.candidateStates?.every((candidateState) => candidateState.status === "failed"));
  assert.ok(
    result?.cacheFile.candidateStates?.every((candidateState) =>
      /Remote preprocess response was incomplete/.test(candidateState.error || "")
    )
  );

  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("symbol preprocess builder retries previously failed wordbook candidates", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-symbol-preprocess-retry-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const sourceCode = [
    "const featureMap = buildFeatureMap(values);",
    "function buildFeatureMap(input) { return input; }",
    "class EmbeddingModel {}"
  ].join("\n");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");
  const candidatePool = buildPreprocessCandidatePool(glossaryEntries);
  let preprocessCalls = 0;
  const provider = {
    id: "openai-compatible",
    async explain() {
      throw new Error("unused");
    },
    async answerFollowUp() {
      return {
        answer: "unused",
        suggestedQuestions: [],
        source: "openai-compatible",
        latencyMs: 1
      };
    },
    async preprocessSymbols(request: SymbolPreprocessRequest) {
      preprocessCalls += 1;

      return {
        requestId: request.requestId,
        languageId: request.languageId,
        source: "openai-compatible",
        latencyMs: 20,
        entries:
          preprocessCalls === 1
            ? request.candidates.slice(0, 1).map((candidate) => ({
                term: candidate.term,
                normalizedTerm: candidate.normalizedTerm,
                category: candidate.category,
                sourceLine: candidate.sourceLine,
                summary: candidate.term + " summary",
                generatedAt: new Date().toISOString()
              }))
            : request.candidates.map((candidate) => ({
                term: candidate.term,
                normalizedTerm: candidate.normalizedTerm,
                category: candidate.category,
                sourceLine: candidate.sourceLine,
                summary: candidate.term + " summary",
                generatedAt: new Date().toISOString()
              }))
      };
    }
  };

  const firstResult = await buildSymbolPreprocessCache({
    editorText: sourceCode,
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    settings: createRemoteSettings(),
    glossaryEntries,
    candidatePool,
    workspaceStore: store,
    provider
  });

  const secondResult = await buildSymbolPreprocessCache({
    editorText: sourceCode,
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    settings: createRemoteSettings(),
    glossaryEntries,
    candidatePool,
    workspaceStore: store,
    provider
  });

  assert.ok(firstResult);
  assert.ok(secondResult);
  assert.equal(firstResult?.failedCandidateCount, candidatePool.length);
  assert.equal(secondResult?.failedCandidateCount, 0);
  assert.equal(secondResult?.cacheFile.entries.length, candidatePool.length);
  assert.ok(secondResult?.cacheFile.candidateStates?.every((candidateState) => candidateState.status === "succeeded"));
  assert.equal(preprocessCalls, 2);

  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

