import {
  ExplanationGranularity,
  ExplanationRequest,
  GlossaryEntry,
  WorkspaceFileSummary,
  WorkspaceIndex
} from "../contracts";
import { humanizeIdentifier, normalizeWhitespace, shortenText } from "../utils/text";

const SUPPORTED_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".md",
  ".yml",
  ".yaml"
]);

export function inferGranularity(
  selectedText: string,
  selectionLineCount: number
): ExplanationGranularity {
  const trimmedText = selectedText.trim();

  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedText)) {
    return "token";
  }

  if (
    /\bfunction\b/.test(trimmedText) ||
    /\bclass\b/.test(trimmedText) ||
    /=>/.test(trimmedText) ||
    /\bdef\b/.test(trimmedText)
  ) {
    return "function";
  }

  if (selectionLineCount > 1 && /[{}]/.test(trimmedText)) {
    return "block";
  }

  return "statement";
}

export function detectPrimaryAction(selectedText: string): string {
  const trimmedText = normalizeWhitespace(selectedText);

  if (/^\s*return\b/.test(trimmedText)) {
    return "returns a value";
  }

  if (/^\s*(if|else if|switch)\b/.test(trimmedText)) {
    return "controls conditional flow";
  }

  if (/^\s*(for|while)\b/.test(trimmedText)) {
    return "iterates over a sequence or condition";
  }

  if (/=\s*>/.test(trimmedText) || /\bfunction\b/.test(trimmedText)) {
    return "defines callable logic";
  }

  if (/=/.test(trimmedText)) {
    return "assigns or derives a value";
  }

  if (/\(/.test(trimmedText) && /\)/.test(trimmedText)) {
    return "invokes an operation";
  }

  return "performs a focused code operation";
}

function extractFunctionName(selectedText: string): string {
  const match =
    selectedText.match(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)/) ??
    selectedText.match(/\bdef\s+([A-Za-z_][A-Za-z0-9_]*)/) ??
    selectedText.match(/\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(/) ??
    selectedText.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(/);

  return match?.[1] ?? "anonymousFunction";
}

function extractFunctionParameters(selectedText: string): string[] {
  const match = selectedText.match(/\(([^)]*)\)/);

  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/[:?].*$/, "").trim())
    .map((part) => part.replace(/^\.{3}/, ""));
}

export function buildLocalSummary(request: ExplanationRequest): string {
  const selectedText = request.selectedText.trim();

  switch (request.granularity) {
    case "token": {
      const term = selectedText;
      const matchingGlossaryEntry = request.glossaryEntries.find(
        (entry) => entry.normalizedTerm === term.toLowerCase()
      );

      return matchingGlossaryEntry
        ? `\`${term}\` usually means: ${matchingGlossaryEntry.meaning}`
        : `\`${term}\` is a single code symbol that should be read in the surrounding context.`;
    }
    case "function": {
      const functionName = extractFunctionName(selectedText);
      const parameters = extractFunctionParameters(selectedText);
      const parameterSummary = parameters.length
        ? ` It appears to accept ${parameters.join(", ")}.`
        : "";

      return `This function-like selection is responsible for ${humanizeIdentifier(functionName)}.${parameterSummary}`;
    }
    case "block":
      return `This code block groups several related steps and mainly ${detectPrimaryAction(selectedText)}.`;
    case "file":
      return buildFileOverviewSummary(selectedText, request.relativeFilePath);
    case "workspace":
      return "This workspace index summarizes the role of each source file in the repository.";
    default:
      return `This statement mainly ${detectPrimaryAction(selectedText)}.`;
  }
}

export function buildSectionContent(
  request: ExplanationRequest,
  sectionName: string
): string {
  const selectedText = request.selectedText.trim();

  switch (sectionName) {
    case "inputOutput": {
      if (request.granularity === "function") {
        const parameters = extractFunctionParameters(selectedText);
        const hasReturn = /\breturn\b/.test(selectedText);

        return `Inputs: ${parameters.length ? parameters.join(", ") : "not explicit"}. Output: ${
          hasReturn ? "returns a computed value or object." : "no explicit return was detected."
        }`;
      }

      if (request.granularity === "token") {
        return "This selection is a symbol, so its input and output depend on the enclosing statement.";
      }

      return "Inputs come from nearby variables and state. Output is the resulting state or value implied by this selection.";
    }
    case "usage":
      return `Use this part when you need the behavior that ${detectPrimaryAction(selectedText)}.`;
    case "syntax":
      return `The selection looks like a ${request.granularity} in ${request.languageId}, so syntax rules for that construct matter more than isolated tokens.`;
    case "risk":
      return /\b(fetch|write|update|delete|push|set|mutate)\b/i.test(selectedText)
        ? "This code may trigger side effects, so verify state changes and external calls."
        : "Main risk is misunderstanding surrounding state, naming, or implicit assumptions.";
    default:
      return buildLocalSummary(request);
  }
}

function extractSymbols(sourceCode: string): string[] {
  const symbols = new Set<string>();

  for (const match of sourceCode.matchAll(
    /\b(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g
  )) {
    symbols.add(match[1]);
  }

  return Array.from(symbols).slice(0, 10);
}

function extractTags(relativePath: string, sourceCode: string): string[] {
  const tags = new Set<string>();

  if (/test/i.test(relativePath)) {
    tags.add("test");
  }

  if (/readme|docs/i.test(relativePath)) {
    tags.add("documentation");
  }

  if (/\bimport\b|\brequire\b/.test(sourceCode)) {
    tags.add("dependency");
  }

  if (/\bexport\b/.test(sourceCode)) {
    tags.add("public-api");
  }

  if (/\bclass\b/.test(sourceCode)) {
    tags.add("class");
  }

  if (/\bfunction\b|=>|\bdef\b/.test(sourceCode)) {
    tags.add("logic");
  }

  if (tags.size === 0) {
    tags.add("source");
  }

  return Array.from(tags);
}

export function buildFileOverviewSummary(
  sourceCode: string,
  relativeFilePath: string
): string {
  const symbols = extractSymbols(sourceCode);
  const tags = extractTags(relativeFilePath, sourceCode);
  const symbolSummary = symbols.length ? ` Key symbols: ${symbols.join(", ")}.` : "";

  return `The file \`${relativeFilePath}\` mainly works as a ${tags.join(", ")} module.${symbolSummary}`;
}

export function createWorkspaceFileSummary(
  relativePath: string,
  languageId: string,
  sourceCode: string
): WorkspaceFileSummary {
  return {
    path: relativePath,
    languageId,
    summary: shortenText(buildFileOverviewSummary(sourceCode, relativePath), 180),
    tags: extractTags(relativePath, sourceCode)
  };
}

export function createWorkspaceIndexMarkdown(index: WorkspaceIndex): string {
  const lines = [
    "# Workspace Index",
    "",
    `Generated at: ${index.generatedAt}`,
    ""
  ];

  for (const file of index.files) {
    lines.push(`- \`${file.path}\` (${file.languageId}): ${file.summary}`);
  }

  return lines.join("\n");
}

export function isSupportedWorkspaceFile(relativePath: string): boolean {
  if (
    relativePath.startsWith(".git/") ||
    relativePath.startsWith("node_modules/") ||
    relativePath.startsWith("dist/") ||
    relativePath.startsWith(".read-code-in-chinese/")
  ) {
    return false;
  }

  const extension = relativePath.slice(relativePath.lastIndexOf("."));
  return SUPPORTED_SOURCE_EXTENSIONS.has(extension.toLowerCase());
}

export function createSuggestedQuestions(
  request: ExplanationRequest,
  glossaryEntries: GlossaryEntry[]
): string[] {
  const questions = new Set<string>();

  if (request.granularity !== "file") {
    questions.add("这一段在整个文件里起什么作用？");
  }

  if (request.granularity !== "function") {
    questions.add("这里最关键的输入输出是什么？");
  }

  const topGlossaryEntry = glossaryEntries[0];

  if (topGlossaryEntry) {
    questions.add(`变量 ${topGlossaryEntry.term} 在这里具体代表什么？`);
  }

  return Array.from(questions).slice(0, 3);
}
