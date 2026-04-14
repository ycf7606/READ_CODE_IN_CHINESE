import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildPreprocessCandidatePool,
  buildPreprocessCandidates,
  getPreprocessTargetSelectionCount
} from "../analysis/preprocess";
import { extractGlossaryEntries } from "../analysis/glossary";
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
import {
  ExplanationRequest,
  PreprocessProgress,
  SymbolPreprocessRequest
} from "../contracts";

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
      customInstructions: ""
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

  const progressSnapshots: Array<{ batchCount: number; processedBatches?: number }> = [];
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
      customInstructions: ""
    },
    glossaryEntries,
    candidatePool,
    workspaceStore: store,
    provider,
    onProgress: (progress: PreprocessProgress) => {
      progressSnapshots.push({
        batchCount: progress.batchCount,
        processedBatches: progress.processedBatches
      });
    }
  });

  assert.ok(result);
  assert.equal(preprocessBatchSizes.length, 3);
  assert.deepEqual(preprocessBatchSizes, [20, 20, 6]);
  assert.ok(progressSnapshots.some((snapshot) => snapshot.batchCount === 3));
  assert.ok(progressSnapshots.some((snapshot) => snapshot.processedBatches === 3));
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
      customInstructions: ""
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
      customInstructions: ""
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

