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
    return "返回一个值";
  }

  if (/^\s*(if|else if|switch)\b/.test(trimmedText)) {
    return "控制条件分支";
  }

  if (/^\s*(for|while)\b/.test(trimmedText)) {
    return "遍历一个序列或条件";
  }

  if (/=\s*>/.test(trimmedText) || /\bfunction\b/.test(trimmedText)) {
    return "定义可调用逻辑";
  }

  if (/=/.test(trimmedText)) {
    return "对值进行赋值或推导";
  }

  if (/\(/.test(trimmedText) && /\)/.test(trimmedText)) {
    return "调用一个操作";
  }

  return "执行一个明确的代码动作";
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
        ? `\`${term}\` 在当前文件里通常表示：${matchingGlossaryEntry.meaning}`
        : `\`${term}\` 是一个独立符号，需要结合周围上下文理解。`;
    }
    case "function": {
      const functionName = extractFunctionName(selectedText);
      const parameters = extractFunctionParameters(selectedText);
      const parameterSummary = parameters.length
        ? ` 它看起来接收这些参数：${parameters.join(", ")}。`
        : "";

      return `这段函数形态的代码主要负责 ${humanizeIdentifier(functionName)}。${parameterSummary}`;
    }
    case "block":
      return `这段代码块把几个相关步骤组织在一起，核心作用是${detectPrimaryAction(selectedText)}。`;
    case "file":
      return buildFileOverviewSummary(selectedText, request.relativeFilePath);
    case "workspace":
      return "这个工作区索引概括了仓库中各个源码文件的角色。";
    default:
      return `这条语句主要是在${detectPrimaryAction(selectedText)}。`;
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

        return `输入：${parameters.length ? parameters.join(", ") : "未显式声明"}。输出：${
          hasReturn ? "会返回一个计算结果或对象。" : "没有检测到显式返回值。"
        }`;
      }

      if (request.granularity === "token") {
        return "当前选区是一个符号，它的输入输出要看所在语句和调用位置。";
      }

      return "输入通常来自附近变量和状态，输出则是这段代码产生的状态变化或结果值。";
    }
    case "usage":
      return `当你需要这段代码去${detectPrimaryAction(selectedText)}时，就会用到这里。`;
    case "syntax":
      return `这段代码在 ${request.languageId} 里更像一个 ${request.granularity} 级结构，所以要优先按这种结构的语法规则理解。`;
    case "risk":
      return /\b(fetch|write|update|delete|push|set|mutate)\b/i.test(selectedText)
        ? "这段代码可能触发副作用，重点确认状态变化和外部调用。"
        : "主要风险在于误解周围状态、命名含义或隐含前提。";
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
  const symbolSummary = symbols.length ? `关键符号：${symbols.join(", ")}。` : "";

  return `文件 \`${relativeFilePath}\` 主要承担 ${tags.join(", ")} 模块的角色。${symbolSummary}`.trim();
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
