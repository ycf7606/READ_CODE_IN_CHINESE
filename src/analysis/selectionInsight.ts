import {
  ExplanationGranularity,
  GlossaryEntry,
  SelectionInsight,
  SelectionSymbolKind,
  SelectionSymbolOrigin
} from "../contracts";
import { shortenText } from "../utils/text";

const PYTHON_BUILTINS = new Set([
  "abs",
  "aiter",
  "all",
  "anext",
  "any",
  "ascii",
  "bin",
  "bool",
  "breakpoint",
  "bytearray",
  "bytes",
  "callable",
  "chr",
  "classmethod",
  "compile",
  "complex",
  "delattr",
  "dict",
  "dir",
  "divmod",
  "enumerate",
  "eval",
  "exec",
  "filter",
  "float",
  "format",
  "frozenset",
  "getattr",
  "globals",
  "hasattr",
  "hash",
  "help",
  "hex",
  "id",
  "input",
  "int",
  "isinstance",
  "issubclass",
  "iter",
  "len",
  "list",
  "locals",
  "map",
  "max",
  "memoryview",
  "min",
  "next",
  "object",
  "oct",
  "open",
  "ord",
  "pow",
  "print",
  "property",
  "range",
  "repr",
  "reversed",
  "round",
  "set",
  "setattr",
  "slice",
  "sorted",
  "staticmethod",
  "str",
  "sum",
  "super",
  "tuple",
  "type",
  "vars",
  "__import__",
  "zip"
]);

const PYTHON_BUILTIN_CONSTANTS = new Set([
  "False",
  "None",
  "NotImplemented",
  "True",
  "Ellipsis",
  "__debug__"
]);

export interface AnalyzeSelectionInsightOptions {
  languageId: string;
  sourceCode: string;
  selectedText: string;
  selectionPreview: string;
  granularity: ExplanationGranularity;
  glossaryEntries: GlossaryEntry[];
  hoverText?: string;
  originHint?: SelectionSymbolOrigin;
}

export function analyzeSelectionInsight(
  options: AnalyzeSelectionInsightOptions
): SelectionInsight | undefined {
  if (options.granularity === "file" || options.granularity === "workspace") {
    return undefined;
  }

  const term = extractSelectedTerm(options.selectedText);

  if (!term) {
    return options.granularity === "function"
      ? {
          term: extractFunctionName(options.selectedText) ?? "selected function",
          kind: "function",
          origin: "local"
        }
      : undefined;
  }

  const glossaryEntry = options.glossaryEntries.find(
    (entry) => entry.normalizedTerm === term.toLowerCase()
  );
  const qualifiedName =
    options.languageId === "python"
      ? resolvePythonQualifiedName(options.sourceCode, options.selectionPreview, options.selectedText)
      : undefined;
  const signature = extractHoverSignature(options.hoverText);
  const documentation = compactHoverDocumentation(options.hoverText, signature);
  const kind = inferSelectionKind(
    options.languageId,
    term,
    options.granularity,
    glossaryEntry,
    options.selectionPreview,
    options.hoverText
  );
  const origin = inferSelectionOrigin(
    options.languageId,
    term,
    qualifiedName,
    glossaryEntry,
    options.hoverText,
    options.originHint
  );

  return {
    term,
    kind,
    origin,
    ...(qualifiedName ? { qualifiedName } : {}),
    ...(signature ? { signature } : {}),
    ...(documentation ? { documentation, documentationSource: "language-service" as const } : {}),
    ...(!documentation && glossaryEntry
      ? {
          documentation: glossaryEntry.meaning,
          documentationSource: "glossary" as const
        }
      : {})
  };
}

export function extractSelectedTerm(selectedText: string): string | undefined {
  const matches = selectedText.trim().match(/[A-Za-z_][A-Za-z0-9_]*/g);
  return matches?.at(-1);
}

export function resolvePythonQualifiedName(
  sourceCode: string,
  selectionPreview: string,
  selectedText: string
): string | undefined {
  const aliases = parsePythonImportAliases(sourceCode);
  const selectedPath = selectedText.trim();
  const previewPath = extractQualifiedPathFromPreview(selectionPreview);
  const candidatePath = selectedPath.includes(".") ? selectedPath : previewPath ?? selectedPath;
  const [root, ...rest] = candidatePath.split(".");
  const resolvedRoot = aliases.get(root);

  if (!resolvedRoot) {
    return undefined;
  }

  return [resolvedRoot, ...rest].filter(Boolean).join(".");
}

export function compactHoverDocumentation(
  hoverText: string | undefined,
  signature?: string
): string | undefined {
  if (!hoverText?.trim()) {
    return undefined;
  }

  const withoutCodeBlocks = hoverText
    .replace(/```[\w+-]*\s*[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const withoutSignature = signature
    ? withoutCodeBlocks.replace(signature.replace(/\s+/g, " "), "").trim()
    : withoutCodeBlocks;

  if (!withoutSignature) {
    return undefined;
  }

  const sentences = withoutSignature.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [withoutSignature];
  return shortenText(sentences.slice(0, 2).join(" ").trim(), 360);
}

export function extractHoverSignature(hoverText: string | undefined): string | undefined {
  if (!hoverText?.trim()) {
    return undefined;
  }

  const codeBlock = hoverText.match(/```[\w+-]*\s*([\s\S]*?)```/);
  const candidateLines = (codeBlock?.[1] ?? hoverText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const signature = candidateLines.find(
    (line) =>
      /^(?:async\s+)?def\s+/.test(line) ||
      /^class\s+/.test(line) ||
      /\([^)]*\)/.test(line) ||
      /^\(function\)|^\(method\)|^\(class\)/i.test(line)
  );

  return signature ? shortenText(signature.replace(/\s+/g, " "), 220) : undefined;
}

function parsePythonImportAliases(sourceCode: string): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const statement of collectPythonImportStatements(sourceCode)) {
    const importMatch = statement.match(/^import\s+(.+)$/);

    if (importMatch) {
      for (const importPart of importMatch[1].split(",")) {
        const parsedImport = importPart.trim().match(
          /^([A-Za-z_][\w.]*)(?:\s+as\s+([A-Za-z_]\w*))?$/
        );

        if (parsedImport) {
          const importedName = parsedImport[1];
          const explicitAlias = parsedImport[2];
          const boundName = explicitAlias ?? importedName.split(".")[0];
          aliases.set(boundName, explicitAlias ? importedName : boundName);
        }
      }
    }

    const fromMatch = statement.match(/^from\s+([A-Za-z_][\w.]*)\s+import\s+(.+)$/);

    if (fromMatch) {
      for (const importPart of fromMatch[2].replace(/[()]/g, "").split(",")) {
        const parsedImport = importPart.trim().match(
          /^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/
        );

        if (parsedImport) {
          aliases.set(
            parsedImport[2] ?? parsedImport[1],
            `${fromMatch[1]}.${parsedImport[1]}`
          );
        }
      }
    }
  }

  return aliases;
}

function collectPythonImportStatements(sourceCode: string): string[] {
  const statements: string[] = [];
  let pending = "";
  let parenthesisDepth = 0;

  for (const rawLine of sourceCode.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "").trim();

    if (!pending && !/^(?:from|import)\s+/.test(line)) {
      continue;
    }

    const continuedByBackslash = line.endsWith("\\");
    const normalizedLine = continuedByBackslash ? line.slice(0, -1).trim() : line;
    pending = pending ? `${pending} ${normalizedLine}` : normalizedLine;
    parenthesisDepth += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;

    if (parenthesisDepth > 0 || continuedByBackslash) {
      continue;
    }

    statements.push(pending.replace(/[()]/g, " ").replace(/\s+/g, " ").trim());
    pending = "";
    parenthesisDepth = 0;
  }

  if (pending) {
    statements.push(pending.replace(/[()]/g, " ").replace(/\s+/g, " ").trim());
  }

  return statements;
}

function extractQualifiedPathFromPreview(selectionPreview: string): string | undefined {
  const directSelection = selectionPreview.match(/\[\[([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)\]\]/);

  if (directSelection) {
    return directSelection[1];
  }

  const memberSelection = selectionPreview.match(
    /([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\.\[\[([A-Za-z_]\w*)\]\]/
  );

  return memberSelection ? `${memberSelection[1]}.${memberSelection[2]}` : undefined;
}

function inferSelectionKind(
  languageId: string,
  term: string,
  granularity: ExplanationGranularity,
  glossaryEntry: GlossaryEntry | undefined,
  selectionPreview: string,
  hoverText: string | undefined
): SelectionSymbolKind {
  if (granularity === "function") {
    return "function";
  }

  if (languageId === "python" && PYTHON_BUILTIN_CONSTANTS.has(term)) {
    return "constant";
  }

  const hover = hoverText?.toLowerCase() ?? "";

  if (/\b(class|type|interface|enum)\b/.test(hover)) {
    return /\bclass\b/.test(hover) ? "class" : "type";
  }

  if (/\b(function|method|def|callable)\b/.test(hover) || /\]\]\s*\(/.test(selectionPreview)) {
    return "function";
  }

  if (/\bconstant\b/.test(hover)) {
    return "constant";
  }

  if (/\b(variable|property|attribute|field)\b/.test(hover)) {
    return "variable";
  }

  if (glossaryEntry) {
    return mapGlossaryCategory(glossaryEntry.category);
  }

  if (/\b(module|package)\b/.test(hover)) {
    return "module";
  }

  return "unknown";
}

function inferSelectionOrigin(
  languageId: string,
  term: string,
  qualifiedName: string | undefined,
  glossaryEntry: GlossaryEntry | undefined,
  hoverText: string | undefined,
  originHint: SelectionSymbolOrigin | undefined
): SelectionSymbolOrigin {
  if (
    languageId === "python" &&
    (PYTHON_BUILTINS.has(term) || PYTHON_BUILTIN_CONSTANTS.has(term))
  ) {
    return "builtin";
  }

  if (originHint === "local" || originHint === "library") {
    return originHint;
  }

  if (qualifiedName || glossaryEntry?.category === "import") {
    return "library";
  }

  if (glossaryEntry && glossaryEntry.category !== "unknown") {
    return "local";
  }

  if (/\b(module|package|site-packages|library)\b/i.test(hoverText ?? "")) {
    return "library";
  }

  return "unknown";
}

function mapGlossaryCategory(category: GlossaryEntry["category"]): SelectionSymbolKind {
  switch (category) {
    case "variable":
    case "function":
    case "class":
    case "type":
    case "constant":
    case "label":
      return category;
    case "import":
      return "module";
    default:
      return "unknown";
  }
}

function extractFunctionName(selectedText: string): string | undefined {
  return (
    selectedText.match(/\b(?:def|function)\s+([A-Za-z_]\w*)/)?.[1] ??
    selectedText.match(/\b([A-Za-z_]\w*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/)?.[1]
  );
}
