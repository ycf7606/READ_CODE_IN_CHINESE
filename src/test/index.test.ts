import test from "node:test";
import assert from "node:assert/strict";
import { extractGlossaryEntries } from "../analysis/glossary";
import {
  buildFileOverviewSummary,
  createWorkspaceFileSummary,
  inferGranularity
} from "../analysis/summary";
import { LocalExplanationProvider } from "../providers/localProvider";
import { ExplanationRequest } from "../contracts";

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
    granularity: "function",
    detailLevel: "balanced",
    professionalLevel: "intermediate",
    sections: ["summary", "inputOutput", "usage"],
    userGoal: "Understand the function quickly",
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
  assert.ok(response.summary.includes("function-like selection"));
  assert.ok(response.sections.length >= 3);
});

test("file overview mentions the target file", () => {
  const summary = buildFileOverviewSummary(
    "export const ready = true;",
    "src/state.ts"
  );

  assert.ok(summary.includes("src/state.ts"));
});
