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
  analyzeSelectionInsight,
  compactHoverDocumentation,
  resolvePythonQualifiedName
} from "../analysis/selectionInsight";
import { attachSelectionDocumentation } from "../analysis/explanationPostprocess";
import {
  evaluatePreprocessPolicy,
  matchesGlob
} from "../analysis/preprocessPolicy";
import {
  buildPreprocessSourceContext,
  createCandidateContextHash
} from "../analysis/symbolContext";
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
  createPreprocessBuildFingerprint,
  PREPROCESS_BUILDER_VERSION
} from "../knowledge/preprocessFingerprint";
import {
  buildCachedPreprocessExplanation,
  buildSymbolPreprocessCache
} from "../knowledge/symbolPreprocessBuilder";
import {
  createTokenKnowledgeCacheKey,
  TokenKnowledgeStore
} from "../knowledge/tokenKnowledgeStore";
import {
  generateGlobalPrompt,
  generatePreprocessAudiencePrompt
} from "../prompts/globalPromptProfile";
import { buildExplainPrompts } from "../prompts/openAICompatiblePrompt";
import { LocalExplanationProvider } from "../providers/localProvider";
import { OpenAICompatibleProvider } from "../providers/openAICompatibleProvider";
import { SourceEditorSessionController } from "../runtime/sourceEditorSession";
import { WorkspaceStore } from "../storage/workspaceStore";
import { createContentHash } from "../utils/hash";
import {
  ExplanationRequest,
  ExtensionSettings,
  PreprocessProgress,
  SymbolPreprocessRequest
} from "../contracts";

function createTestSettings(
  overrides: Partial<ExtensionSettings> = {}
): ExtensionSettings {
  return {
    autoExplainEnabled: false,
    autoExplainDelayMs: 600,
    autoOpenPanel: true,
    providerId: "openai-compatible",
    providerBaseUrl: "https://example.com/v1",
    providerModel: "test-model",
    providerApiKeyEnvVar: "READ_CODE_IN_CHINESE_API_KEY",
    providerFallbacks: [],
    providerTimeoutMs: 20_000,
    providerTemperature: 0.2,
    providerTopP: 1,
    providerMaxTokens: 1200,
    providerReasoningEffort: "medium",
    providerRequireTrustedWorkspace: true,
    detailLevel: "balanced",
    professionalLevel: "beginner",
    occupation: "developer",
    sections: ["summary", "usage"],
    userGoal: "",
    knowledgeTopK: 3,
    customInstructions: "",
    preprocessMode: "manual",
    preprocessExclude: [],
    preprocessMaxFileBytes: 262_144,
    preprocessMaxCandidates: 120,
    ...overrides
  };
}

test("source editor session keeps one current task per workflow", () => {
  const session = new SourceEditorSessionController<string>();
  const firstTask = session.startTask("explain");
  let firstTaskWasCurrentDuringAbort = true;
  firstTask.controller.signal.addEventListener("abort", () => {
    firstTaskWasCurrentDuringAbort = session.isTaskCurrent("explain", firstTask.version);
  });
  const secondTask = session.startTask("explain");

  assert.equal(firstTask.controller.signal.aborted, true);
  assert.equal(firstTaskWasCurrentDuringAbort, false);
  assert.equal(session.isTaskCurrent("explain", firstTask.version), false);
  assert.equal(session.isTaskCurrent("explain", secondTask.version), true);
  assert.equal(session.finishTask("explain", firstTask.version), false);
  assert.equal(session.finishTask("explain", secondTask.version), true);
  assert.equal(session.isTaskCurrent("explain", secondTask.version), false);
});

test("source editor session clears canceled tasks and preserves editor fallback", () => {
  const session = new SourceEditorSessionController("initial-editor");
  const task = session.startTask("preprocess");

  session.trackEditor("tracked-editor");

  assert.equal(session.getPreferredEditor(), "tracked-editor");
  assert.equal(session.getPreferredEditor("explicit-editor", "active-editor"), "explicit-editor");
  assert.equal(session.getPreferredEditor(undefined, "active-editor"), "active-editor");
  assert.equal(session.cancelTask("preprocess"), task);
  assert.equal(task.controller.signal.aborted, true);
  assert.equal(session.isTaskCurrent("preprocess", task.version), false);

  const followUpTask = session.startTask("follow-up");
  session.dispose();

  assert.equal(followUpTask.controller.signal.aborted, true);
  assert.equal(session.getPreferredEditor(), undefined);
});

test("source editor session deduplicates selections and prioritizes recent reading areas", () => {
  const session = new SourceEditorSessionController<string>(undefined, 2);

  assert.equal(session.acceptAutoExplainSignature("file:1:token"), true);
  assert.equal(session.acceptAutoExplainSignature("file:1:token"), false);
  assert.equal(session.acceptAutoExplainSignature("file:2:token"), true);
  session.resetAutoExplainSignature();
  assert.equal(session.acceptAutoExplainSignature("file:2:token"), true);

  session.recordSelectionLine("src/example.ts", 1);
  session.recordSelectionLine("src/example.ts", 100);
  session.recordSelectionLine("src/example.ts", 101);

  assert.equal(session.getSelectionPriorityScore("src/example.ts", 1), 0);
  assert.ok(
    session.getSelectionPriorityScore("src/example.ts", 101) >
      session.getSelectionPriorityScore("src/example.ts", 80)
  );
  assert.equal(session.getSelectionPriorityScore("src/other.ts", 101), 0);
});

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
  const entries = attachWordbookScopePaths(
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
    ],
    sourceCode,
    "python"
  );

  assert.deepEqual(entries[0].scopePath, ["class SpectralNet", "function __init__"]);
  assert.deepEqual(entries[1].scopePath, ["class SpectralNet", "function squeeze"]);
  assert.deepEqual(entries[2].scopePath, ["function build_model"]);
});

test("inferGranularity distinguishes token, function, and block", () => {
  assert.equal(inferGranularity("userCount", 1), "token");
  assert.equal(inferGranularity("numpy.asarray", 1), "token");
  assert.equal(inferGranularity("function loadUsers(id) { return id; }", 1), "function");
  assert.equal(inferGranularity("if (ready) {\n  run();\n}", 3), "block");
});

test("selection insight separates local variables from Python library functions", () => {
  const sourceCode = [
    "import numpy as np",
    "feature_map = np.asarray(values)",
    "result = feature_map.mean()"
  ].join("\n");
  const glossaryEntries = extractGlossaryEntries(sourceCode, "python");
  const variableInsight = analyzeSelectionInsight({
    languageId: "python",
    sourceCode,
    selectedText: "feature_map",
    selectionPreview: "[[feature_map]] = np.asarray(values)",
    granularity: "token",
    glossaryEntries
  });
  const functionInsight = analyzeSelectionInsight({
    languageId: "python",
    sourceCode,
    selectedText: "asarray",
    selectionPreview: "feature_map = np.[[asarray]](values)",
    granularity: "token",
    glossaryEntries,
    hoverText: [
      "```python",
      "def asarray(a, dtype=None) -> ndarray",
      "```",
      "Convert the input to an array. The result may reuse existing memory."
    ].join("\n")
  });

  assert.equal(variableInsight?.kind, "variable");
  assert.equal(variableInsight?.origin, "local");
  assert.equal(functionInsight?.kind, "function");
  assert.equal(functionInsight?.origin, "library");
  assert.equal(functionInsight?.qualifiedName, "numpy.asarray");
  assert.match(functionInsight?.signature ?? "", /def asarray/);
  assert.match(functionInsight?.documentation ?? "", /Convert the input/);
});

test("definition origin hint keeps workspace Python imports local", () => {
  const insight = analyzeSelectionInsight({
    languageId: "python",
    sourceCode: "from project.helpers import build_result",
    selectedText: "build_result",
    selectionPreview: "value = [[build_result]](items)",
    granularity: "token",
    glossaryEntries: [],
    originHint: "local",
    hoverText: "```python\ndef build_result(items) -> Result\n```"
  });

  assert.equal(insight?.qualifiedName, "project.helpers.build_result");
  assert.equal(insight?.origin, "local");
  assert.equal(insight?.kind, "function");
});

test("Python qualified-name resolution and hover documentation stay compact", () => {
  const sourceCode = [
    "from pathlib import Path as FilePath",
    "import pandas as pd",
    "import os.path",
    "from collections import (",
    "    Counter,",
    "    defaultdict as DefaultDict,",
    ")"
  ].join("\n");
  const longDocumentation =
    "First sentence explains the API. Second sentence adds one constraint. " +
    "Third sentence should not be needed. ".repeat(20);

  assert.equal(
    resolvePythonQualifiedName(sourceCode, "[[FilePath]]('a.txt')", "FilePath"),
    "pathlib.Path"
  );
  assert.equal(
    resolvePythonQualifiedName(sourceCode, "pd.[[DataFrame]](rows)", "DataFrame"),
    "pandas.DataFrame"
  );
  assert.equal(
    resolvePythonQualifiedName(sourceCode, "os.path.[[join]]('a', 'b')", "join"),
    "os.path.join"
  );
  assert.equal(
    resolvePythonQualifiedName(sourceCode, "[[Counter]](items)", "Counter"),
    "collections.Counter"
  );
  assert.equal(
    resolvePythonQualifiedName(sourceCode, "[[DefaultDict]](list)", "DefaultDict"),
    "collections.defaultdict"
  );
  assert.ok((compactHoverDocumentation(longDocumentation)?.length ?? 0) <= 360);
  assert.doesNotMatch(compactHoverDocumentation(longDocumentation) ?? "", /Third sentence/);
});

test("library documentation is attached once and stays concise", () => {
  const request: ExplanationRequest = {
    requestId: "library-doc",
    reason: "manual",
    languageId: "python",
    filePath: "D:/workspace/example.py",
    relativeFilePath: "example.py",
    selectedText: "asarray",
    selectionPreview: "result = np.[[asarray]](values)",
    granularity: "token",
    detailLevel: "balanced",
    occupation: "developer",
    professionalLevel: "intermediate",
    sections: ["summary", "usage"],
    userGoal: "",
    customInstructions: "",
    contextBefore: "import numpy as np",
    contextAfter: "",
    selectionInsight: {
      term: "asarray",
      kind: "function",
      origin: "library",
      qualifiedName: "numpy.asarray",
      signature: "def asarray(a, dtype=None) -> ndarray",
      documentation: "Convert the input to an array. " + "Additional implementation detail. ".repeat(30),
      documentationSource: "language-service"
    },
    glossaryEntries: [],
    knowledgeSnippets: []
  };
  const response = {
    requestId: request.requestId,
    title: "numpy.asarray",
    summary: "把当前输入转换为数组。",
    sections: [],
    suggestedQuestions: [],
    glossaryHints: [],
    granularity: request.granularity,
    selectionText: request.selectedText,
    source: "openai-compatible",
    latencyMs: 10,
    knowledgeUsed: []
  };
  const attached = attachSelectionDocumentation(response, request);
  const attachedAgain = attachSelectionDocumentation(attached, request);
  const glossaryOnly = attachSelectionDocumentation(response, {
    ...request,
    selectionInsight: {
      term: "asarray",
      kind: "function",
      origin: "library",
      qualifiedName: "numpy.asarray",
      documentation: "Generated glossary wording, not language-service documentation.",
      documentationSource: "glossary"
    }
  });

  assert.equal(attached.sections[0]?.label, "文档依据");
  assert.match(attached.sections[0]?.items?.[0] ?? "", /def asarray/);
  assert.ok((attached.sections[0]?.items?.[1]?.length ?? 0) <= 286);
  assert.equal(attachedAgain.sections.filter((section) => section.label === "文档依据").length, 1);
  assert.equal(glossaryOnly.sections.length, 0);
});

test("preprocess source context keeps relevant definition and usage windows", () => {
  const sourceCode = [
    "const featureMap = buildFeatureMap(values);",
    "const unrelated = 1;",
    "function helper() { return unrelated; }",
    "consume(featureMap);"
  ].join("\n");
  const candidate = {
    term: "featureMap",
    normalizedTerm: "featuremap",
    category: "variable" as const,
    sourceLine: 1,
    references: 2,
    score: 50
  };
  const context = buildPreprocessSourceContext(sourceCode, [candidate]);

  assert.match(context, /1: const featureMap/);
  assert.match(context, /4: consume\(featureMap\)/);
  assert.equal(
    createCandidateContextHash(sourceCode, candidate),
    createCandidateContextHash(sourceCode, candidate)
  );
});

test("preprocess source context preserves long scopes and gives every candidate a budget", () => {
  const sourceCode = [
    "def first(items):",
    ...Array.from({ length: 18 }, (_, index) => `    step_${index} = items[${index}]`),
    "    return step_17",
    "",
    "def second(value):",
    "    return value * 2"
  ].join("\n");
  const candidates = [
    {
      term: "first",
      normalizedTerm: "first",
      category: "function" as const,
      sourceLine: 1,
      references: 1,
      score: 100
    },
    {
      term: "second",
      normalizedTerm: "second",
      category: "function" as const,
      sourceLine: 22,
      references: 1,
      score: 90
    }
  ];
  const fullContext = buildPreprocessSourceContext(sourceCode, candidates);
  const limitedContext = buildPreprocessSourceContext(sourceCode, candidates, 260);

  assert.match(fullContext, /20:     return step_17/);
  assert.match(limitedContext, /### first/);
  assert.match(limitedContext, /### second/);
  assert.ok(limitedContext.length <= 260);
});

test("preprocess policy blocks unsafe automatic uploads", () => {
  assert.equal(matchesGlob(".env.local", "**/.env*"), true);
  assert.equal(matchesGlob("config/secrets.json", "**/secrets.*"), true);
  assert.equal(
    evaluatePreprocessPolicy({
      trigger: "idle",
      mode: "manual",
      workspaceTrusted: true,
      requireTrustedWorkspace: true,
      relativeFilePath: "src/example.ts",
      fileBytes: 100,
      maxFileBytes: 1000,
      excludePatterns: []
    }).allowed,
    false
  );
  assert.match(
    evaluatePreprocessPolicy({
      trigger: "manual",
      mode: "manual",
      workspaceTrusted: false,
      requireTrustedWorkspace: true,
      relativeFilePath: "src/example.ts",
      fileBytes: 100,
      maxFileBytes: 1000,
      excludePatterns: []
    }).reason ?? "",
    /未受信任/
  );
  assert.match(
    evaluatePreprocessPolicy({
      trigger: "manual",
      mode: "manual",
      workspaceTrusted: true,
      requireTrustedWorkspace: true,
      relativeFilePath: ".env.local",
      fileBytes: 100,
      maxFileBytes: 1000,
      excludePatterns: ["**/.env*"]
    }).reason ?? "",
    /排除规则/
  );
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

test("symbol preprocess reuses unchanged symbol context after unrelated edits", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-symbol-context-cache-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const sourceBefore = [
    "const featureMap = buildFeatureMap(values);",
    "consume(featureMap);",
    "",
    "const distantSetting = 1;"
  ].join("\n");
  const sourceAfter = sourceBefore.replace("distantSetting = 1", "distantSetting = 2");
  const candidatePool = [
    {
      term: "featureMap",
      normalizedTerm: "featuremap",
      category: "variable" as const,
      sourceLine: 1,
      references: 2,
      score: 80
    }
  ];
  let preprocessCallCount = 0;
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
      preprocessCallCount += 1;
      return {
        requestId: request.requestId,
        languageId: request.languageId,
        source: "openai-compatible",
        latencyMs: 1,
        entries: request.candidates.map((candidate) => ({
          term: candidate.term,
          normalizedTerm: candidate.normalizedTerm,
          category: candidate.category,
          sourceLine: candidate.sourceLine,
          summary: "Stores the current feature mapping.",
          generatedAt: new Date().toISOString()
        }))
      };
    }
  };
  const baseOptions = {
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    settings: createTestSettings(),
    glossaryEntries: [],
    candidatePool,
    workspaceStore: store,
    provider
  };

  await buildSymbolPreprocessCache({
    ...baseOptions,
    editorText: sourceBefore
  });
  const secondResult = await buildSymbolPreprocessCache({
    ...baseOptions,
    editorText: sourceAfter
  });

  assert.equal(preprocessCallCount, 1);
  assert.equal(secondResult?.source, "cache");
  assert.ok(secondResult?.cacheFile.entries[0]?.contextHash);
  assert.equal(secondResult?.cacheFile.sourceHash, createContentHash(sourceAfter));
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("symbol preprocess invalidates cache when the build fingerprint changes", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-symbol-fingerprint-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const sourceCode = "const featureMap = buildFeatureMap(values);";
  const candidatePool = [
    {
      term: "featureMap",
      normalizedTerm: "featuremap",
      category: "variable" as const,
      sourceLine: 1,
      references: 1,
      score: 100
    }
  ];
  let preprocessCallCount = 0;
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
      preprocessCallCount += 1;
      return {
        requestId: request.requestId,
        languageId: request.languageId,
        source: "openai-compatible",
        latencyMs: 1,
        entries: request.candidates.map((candidate) => ({
          term: candidate.term,
          normalizedTerm: candidate.normalizedTerm,
          category: candidate.category,
          sourceLine: candidate.sourceLine,
          summary: `summary-${preprocessCallCount}`,
          generatedAt: new Date().toISOString()
        }))
      };
    }
  };
  const firstSettings = createTestSettings({ providerModel: "model-a" });
  const secondSettings = createTestSettings({ providerModel: "model-b" });

  const first = await buildSymbolPreprocessCache({
    editorText: sourceCode,
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    settings: firstSettings,
    glossaryEntries: [],
    candidatePool,
    workspaceStore: store,
    provider
  });
  const second = await buildSymbolPreprocessCache({
    editorText: sourceCode,
    languageId: "typescript",
    filePath: "D:/workspace/src/example.ts",
    relativeFilePath: "src/example.ts",
    settings: secondSettings,
    glossaryEntries: [],
    candidatePool,
    workspaceStore: store,
    provider
  });

  assert.equal(preprocessCallCount, 2);
  assert.equal(first?.cacheFile.builderVersion, PREPROCESS_BUILDER_VERSION);
  assert.equal(
    second?.cacheFile.buildFingerprint,
    createPreprocessBuildFingerprint(secondSettings)
  );
  assert.notEqual(first?.cacheFile.buildFingerprint, second?.cacheFile.buildFingerprint);
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
      providerRequireTrustedWorkspace: true,
      detailLevel: "balanced",
      professionalLevel: "intermediate",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessMode: "manual",
      preprocessExclude: [],
      preprocessMaxFileBytes: 262_144,
      preprocessMaxCandidates: 120
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

  const progressSnapshots: Array<{
    batchCount: number;
    processedBatches?: number;
    currentStep?: string;
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
      providerRequireTrustedWorkspace: true,
      detailLevel: "balanced",
      professionalLevel: "beginner",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessMode: "manual",
      preprocessExclude: [],
      preprocessMaxFileBytes: 262_144,
      preprocessMaxCandidates: 120
    },
    glossaryEntries,
    candidatePool,
    workspaceStore: store,
    provider,
    onProgress: (progress: PreprocessProgress) => {
      progressSnapshots.push({
        batchCount: progress.batchCount,
        processedBatches: progress.processedBatches,
        currentStep: progress.currentStep
      });
    }
  });

  assert.ok(result);
  assert.equal(preprocessBatchSizes.length, 3);
  assert.deepEqual(preprocessBatchSizes, [20, 20, 6]);
  assert.ok(
    progressSnapshots.some(
      (snapshot) =>
        snapshot.currentStep === "Selecting wordbook terms" && snapshot.batchCount === 0
    )
  );
  assert.ok(progressSnapshots.some((snapshot) => snapshot.batchCount === 3));
  assert.ok(progressSnapshots.some((snapshot) => snapshot.processedBatches === 3));
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("symbol preprocess builder falls back per chunk when a remote batch fails", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-symbol-preprocess-chunk-fallback-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const sourceCode = "export const ready = true;";
  const glossaryEntries = extractGlossaryEntries(sourceCode, "typescript");
  const candidatePool = Array.from({ length: 41 }, (_, index) => ({
    term: `symbol_${index}`,
    normalizedTerm: `symbol_${index}`,
    category: index % 2 === 0 ? "variable" : "function",
    sourceLine: index + 1,
    references: 2,
    score: 100 - index
  })) satisfies ReturnType<typeof buildPreprocessCandidatePool>;
  let preprocessCallCount = 0;
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
      preprocessCallCount += 1;

      if (preprocessCallCount === 2) {
        throw new Error("simulated remote chunk failure");
      }

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
          summary: candidate.term + " remote summary",
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
      providerRequireTrustedWorkspace: true,
      detailLevel: "balanced",
      professionalLevel: "beginner",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessMode: "manual",
      preprocessExclude: [],
      preprocessMaxFileBytes: 262_144,
      preprocessMaxCandidates: 120
    },
    glossaryEntries,
    candidatePool,
    workspaceStore: store,
    provider
  });

  assert.ok(result);
  assert.equal(preprocessCallCount, 3);
  assert.equal(result?.cacheFile.entries.length, 41);
  assert.equal(result?.source, "mixed");
  assert.match(
    result?.cacheFile.entries.find((entry) => entry.term === "symbol_0")?.summary ?? "",
    /remote summary/
  );
  assert.match(
    result?.cacheFile.entries.find((entry) => entry.term === "symbol_20")?.summary ?? "",
    /当前文件中的/
  );
  assert.match(
    result?.cacheFile.entries.find((entry) => entry.term === "symbol_40")?.summary ?? "",
    /remote summary/
  );
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
      providerRequireTrustedWorkspace: true,
      detailLevel: "balanced",
      professionalLevel: "beginner",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessMode: "manual",
      preprocessExclude: [],
      preprocessMaxFileBytes: 262_144,
      preprocessMaxCandidates: 120
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
    selectionInsight: {
      term: "squeeze",
      kind: "function",
      origin: "library",
      qualifiedName: "torch.Tensor.squeeze",
      signature: "squeeze(dim=None) -> Tensor",
      documentation: "Returns a tensor with dimensions of size one removed.",
      documentationSource: "language-service"
    },
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
  assert.match(prompts.system, /callable logic/i);
  assert.match(prompts.system, /primary factual source/i);
  assert.match(prompts.user, /torch\.Tensor\.squeeze/);
  assert.match(prompts.system, /tensor, feature, shape, pipeline/i);
});

test("token knowledge cache isolates qualified APIs and local callsites", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "rcic-token-identity-")
  );
  const store = new WorkspaceStore(workspaceRoot);
  await store.ensureProjectDataDirectories();
  const tokenStore = new TokenKnowledgeStore(store);
  const buildResponse = (requestId: string, summary: string) => ({
    requestId,
    title: requestId,
    summary,
    sections: [],
    suggestedQuestions: [],
    glossaryHints: [],
    granularity: "token" as const,
    selectionText: "asarray",
    source: "openai-compatible",
    latencyMs: 1,
    knowledgeUsed: []
  });
  const numpyIdentity = {
    term: "asarray",
    qualifiedName: "numpy.asarray",
    origin: "library" as const
  };
  const cupyIdentity = {
    term: "asarray",
    qualifiedName: "cupy.asarray",
    origin: "library" as const
  };

  await tokenStore.upsert("python", numpyIdentity, buildResponse("numpy", "NumPy array"));

  assert.equal((await tokenStore.find("python", numpyIdentity))?.explanation.summary, "NumPy array");
  assert.equal(await tokenStore.find("python", cupyIdentity), undefined);
  assert.notEqual(
    createTokenKnowledgeCacheKey(numpyIdentity),
    createTokenKnowledgeCacheKey(cupyIdentity)
  );

  await tokenStore.upsert(
    "python",
    { term: "result", origin: "local", contextHash: "scope-a" },
    buildResponse("local-a", "First local result")
  );
  assert.equal(
    await tokenStore.find("python", {
      term: "result",
      origin: "local",
      contextHash: "scope-b"
    }),
    undefined
  );
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("variable explanations use data-flow guidance instead of function guidance", async () => {
  const request: ExplanationRequest = {
    requestId: "variable-prompt",
    reason: "manual",
    languageId: "python",
    filePath: "D:/workspace/model.py",
    relativeFilePath: "model.py",
    selectedText: "feature_map",
    selectionPreview: "[[feature_map]] = encoder(inputs)",
    granularity: "token",
    selectionInsight: {
      term: "feature_map",
      kind: "variable",
      origin: "local",
      documentation: "Variable that stores the encoded feature map.",
      documentationSource: "glossary"
    },
    detailLevel: "balanced",
    occupation: "data-scientist",
    professionalLevel: "intermediate",
    sections: ["summary", "inputOutput", "risk"],
    userGoal: "Understand feature flow",
    customInstructions: "",
    contextBefore: "inputs = batch.images",
    contextAfter: "scores = head(feature_map)",
    glossaryEntries: [],
    knowledgeSnippets: []
  };
  const prompts = buildExplainPrompts(request);
  const response = await new LocalExplanationProvider().explain(request);

  assert.match(prompts.system, /Treat the selection as data/i);
  assert.match(prompts.system, /where the value comes from/i);
  assert.doesNotMatch(prompts.system, /Treat the selection as callable logic/i);
  assert.equal(response.title, "变量：feature_map");
  assert.match(response.summary, /赋值来源/);
  assert.match(
    response.sections.find((section) => section.label === "risk")?.content ?? "",
    /空值|形状|修改/
  );
});

test("explanation panel avoids dynamic innerHTML and exposes stable interaction controls", async () => {
  const panelSource = await fs.readFile(
    path.join(process.cwd(), "src", "ui", "explanationPanel.ts"),
    "utf8"
  );

  assert.doesNotMatch(panelSource, /\.innerHTML\s*=/);
  assert.match(panelSource, /toggleSelectionWatch/);
  assert.match(panelSource, /sendButton\.disabled/);
  assert.match(panelSource, /questionInput\.disabled = Boolean\(payload\.isLoading \|\| !explanation\)/);
  assert.match(panelSource, /sendButton\.disabled = true/);
  assert.match(panelSource, /aria-selected/);
  assert.match(panelSource, /replaceChildren/);
});

test("settings panel exposes remote trust and preprocess cost controls", async () => {
  const settingsPanelSource = await fs.readFile(
    path.join(process.cwd(), "src", "ui", "settingsPanel.ts"),
    "utf8"
  );

  assert.match(settingsPanelSource, /providerRequireTrustedWorkspace/);
  assert.match(settingsPanelSource, /preprocessMode/);
  assert.match(settingsPanelSource, /preprocessExclude/);
  assert.match(settingsPanelSource, /preprocessMaxFileBytes/);
  assert.match(settingsPanelSource, /preprocessMaxCandidates/);
  assert.doesNotMatch(settingsPanelSource, /\.innerHTML\s*=/);
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
      providerRequireTrustedWorkspace: true,
      detailLevel: "balanced",
      professionalLevel: "intermediate",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessMode: "manual",
      preprocessExclude: [],
      preprocessMaxFileBytes: 262_144,
      preprocessMaxCandidates: 120
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

test("openai provider fails over to fallback endpoint", async () => {
  const originalFetch = globalThis.fetch;
  process.env.TEST_OPENAI_PROVIDER_KEY = "primary-key";
  process.env.TEST_OPENAI_PROVIDER_KEY_FALLBACK = "fallback-key";
  const requestedUrls: string[] = [];

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.startsWith("https://primary.example.com/v1")) {
      return new Response("upstream failure", {
        status: 502,
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
                title: "Tensor Call",
                summary: "来自备用接口。",
                sections: [
                  {
                    label: "summary",
                    content: "来自备用接口。"
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
    );
  }) as unknown as typeof fetch;

  try {
    const provider = new OpenAICompatibleProvider({
      autoExplainEnabled: false,
      autoExplainDelayMs: 600,
      autoOpenPanel: true,
      providerId: "openai-compatible",
      providerBaseUrl: "https://primary.example.com/v1",
      providerModel: "gpt-5.4",
      providerApiKeyEnvVar: "TEST_OPENAI_PROVIDER_KEY",
      providerFallbacks: [
        {
          baseUrl: "https://fallback.example.com/v1",
          apiKeyEnvVar: "TEST_OPENAI_PROVIDER_KEY_FALLBACK",
          model: "gpt-5.4"
        }
      ],
      providerTimeoutMs: 1000,
      providerTemperature: 0.2,
      providerTopP: 1,
      providerMaxTokens: 1200,
      providerReasoningEffort: "medium",
      providerRequireTrustedWorkspace: true,
      detailLevel: "balanced",
      professionalLevel: "intermediate",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessMode: "manual",
      preprocessExclude: [],
      preprocessMaxFileBytes: 262_144,
      preprocessMaxCandidates: 120
    });
    const response = await provider.explain({
      requestId: "remote-fallback",
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

    assert.equal(response.summary, "来自备用接口。");
    assert.ok(requestedUrls.some((url) => url.startsWith("https://primary.example.com/v1")));
    assert.ok(requestedUrls.some((url) => url.startsWith("https://fallback.example.com/v1")));
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.TEST_OPENAI_PROVIDER_KEY;
    delete process.env.TEST_OPENAI_PROVIDER_KEY_FALLBACK;
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
      providerRequireTrustedWorkspace: true,
      detailLevel: "balanced",
      professionalLevel: "intermediate",
      occupation: "developer",
      sections: ["summary", "usage"],
      userGoal: "",
      knowledgeTopK: 3,
      customInstructions: "",
      preprocessMode: "manual",
      preprocessExclude: [],
      preprocessMaxFileBytes: 262_144,
      preprocessMaxCandidates: 120
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




