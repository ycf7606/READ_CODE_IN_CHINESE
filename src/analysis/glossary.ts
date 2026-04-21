import { GlossaryCategory, GlossaryEntry } from "../contracts";
import { humanizeIdentifier } from "../utils/text";

const COMMON_KEYWORDS = new Set([
  "if",
  "else",
  "for",
  "while",
  "return",
  "switch",
  "case",
  "break",
  "continue",
  "function",
  "class",
  "const",
  "let",
  "var",
  "import",
  "from",
  "export",
  "default",
  "new",
  "async",
  "await",
  "public",
  "private",
  "protected",
  "static",
  "type",
  "interface",
  "enum",
  "extends",
  "implements",
  "true",
  "false",
  "null",
  "undefined",
  "this",
  "super",
  "try",
  "catch",
  "finally",
  "throw",
  "in",
  "of"
]);
const METHOD_NAME_EXCLUSIONS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "return",
  "constructor"
]);

const LABEL_CONTEXT_PATTERN =
  /\b(?:class|label|categor(?:y|ies)|target|name|type|tag)[A-Za-z_]*\b/i;

const CATEGORY_PRIORITY: Record<GlossaryCategory, number> = {
  unknown: 0,
  import: 1,
  constant: 2,
  variable: 3,
  function: 4,
  class: 4,
  type: 4,
  label: 5
};

function buildMeaning(term: string, category: GlossaryCategory): string {
  const phrase = humanizeIdentifier(term) || term.toLowerCase();

  if (/^(is|has|can|should)[A-Z_]/.test(term)) {
    return `Boolean flag related to ${phrase}.`;
  }

  if (/(count|total|size|length)$/i.test(term)) {
    return `Numeric value for ${phrase}.`;
  }

  if (/(list|items|array)$/i.test(term)) {
    return `Collection that stores ${phrase}.`;
  }

  if (/(map|dict|lookup)$/i.test(term)) {
    return `Lookup structure for ${phrase}.`;
  }

  switch (category) {
    case "function":
      return `Function that handles ${phrase}.`;
    case "class":
      return `Class that models ${phrase}.`;
    case "type":
      return `Type definition for ${phrase}.`;
    case "label":
      return `Label or category name "${term}" used in the current file.`;
    case "import":
      return `Imported symbol for ${phrase}.`;
    case "constant":
      return `Constant value for ${phrase}.`;
    case "variable":
      return `Variable that represents ${phrase}.`;
    default:
      return `Code symbol related to ${phrase}.`;
  }
}

function addEntry(
  map: Map<string, GlossaryEntry>,
  term: string,
  category: GlossaryCategory,
  sourceLine: number
): void {
  const trimmedTerm = term.trim();
  const isLabel = category === "label";
  const isValidTerm = isLabel
    ? /^[A-Za-z][A-Za-z0-9_-]*$/.test(trimmedTerm)
    : /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedTerm);

  if (!isValidTerm || COMMON_KEYWORDS.has(trimmedTerm.toLowerCase())) {
    return;
  }

  const normalizedTerm = trimmedTerm.toLowerCase();
  const existingEntry = map.get(normalizedTerm);

  if (existingEntry) {
    existingEntry.references += 1;
    if (!existingEntry.sourceLine && sourceLine > 0) {
      existingEntry.sourceLine = sourceLine;
    }
    if (CATEGORY_PRIORITY[category] > CATEGORY_PRIORITY[existingEntry.category]) {
      existingEntry.category = category;
      existingEntry.meaning = buildMeaning(existingEntry.term, category);
    }
    return;
  }

  map.set(normalizedTerm, {
    term: trimmedTerm,
    normalizedTerm,
    meaning: buildMeaning(trimmedTerm, category),
    category,
    sourceLine,
    references: 1,
    source: "generated",
    updatedAt: new Date().toISOString()
  });
}

function addStringLabelEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number
): void {
  if (!LABEL_CONTEXT_PATTERN.test(line)) {
    return;
  }

  for (const match of line.matchAll(/['"`]([A-Za-z][A-Za-z0-9_-]{1,40})['"`]/g)) {
    addEntry(map, match[1], "label", lineNumber);
  }
}

function addPythonAssignmentEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number
): void {
  if (/^\s*(def|class)\b/.test(line)) {
    return;
  }

  for (const match of line.matchAll(/(?:^|[\s,(])([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?![=>=])/g)) {
    addEntry(map, match[1], "variable", lineNumber);
  }

  for (const match of line.matchAll(/\b(?:self|cls)\.([A-Za-z_][A-Za-z0-9_]*)\s*=/g)) {
    addEntry(map, match[1], "variable", lineNumber);
  }
}

function addMemberFunctionEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number
): void {
  for (const match of line.matchAll(/\b(?:this|self|cls)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    addEntry(map, match[1], "function", lineNumber);
  }
}

function addAssignedFunctionEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number
): void {
  for (const match of line.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s+)?function\b/g
  )) {
    addEntry(map, match[1], "function", lineNumber);
  }

  for (const match of line.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/g
  )) {
    addEntry(map, match[1], "function", lineNumber);
  }
}

function addObjectFunctionPropertyEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number
): void {
  for (const match of line.matchAll(
    /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*(?:async\s+)?function\b/g
  )) {
    addEntry(map, match[1], "function", lineNumber);
  }

  for (const match of line.matchAll(
    /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/g
  )) {
    addEntry(map, match[1], "function", lineNumber);
  }
}

function addMethodDefinitionEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number
): void {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith("//") || trimmedLine.startsWith("*")) {
    return;
  }

  const methodMatch =
    /^(?:(?:export|public|private|protected|static|async|override|get|set|readonly)\s+)*([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^;=]*\)\s*\{/.exec(
      trimmedLine
    );

  if (!methodMatch) {
    return;
  }

  const methodName = methodMatch[1];

  if (METHOD_NAME_EXCLUSIONS.has(methodName)) {
    return;
  }

  addEntry(map, methodName, "function", lineNumber);
}

export function extractGlossaryEntries(
  sourceCode: string,
  languageId: string,
  maxEntries = 60
): GlossaryEntry[] {
  const glossaryMap = new Map<string, GlossaryEntry>();
  const lines = sourceCode.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    for (const match of line.matchAll(/\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
      addEntry(glossaryMap, match[1], "variable", lineNumber);
    }

    for (const match of line.matchAll(/\b(?:this|self)\.([A-Za-z_][A-Za-z0-9_]*)\s*=/g)) {
      addEntry(glossaryMap, match[1], "variable", lineNumber);
    }

    for (const match of line.matchAll(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
      addEntry(glossaryMap, match[1], "function", lineNumber);
    }

    addAssignedFunctionEntries(glossaryMap, line, lineNumber);
    addObjectFunctionPropertyEntries(glossaryMap, line, lineNumber);
    addMethodDefinitionEntries(glossaryMap, line, lineNumber);
    addMemberFunctionEntries(glossaryMap, line, lineNumber);

    for (const match of line.matchAll(
      /\b(?:class|interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g
    )) {
      const keyword = match[0].split(/\s+/)[0];
      const category =
        keyword === "class"
          ? "class"
          : keyword === "interface" || keyword === "type" || keyword === "enum"
            ? "type"
            : "unknown";

      addEntry(glossaryMap, match[1], category, lineNumber);
    }

    for (const match of line.matchAll(/\bimport\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
      addEntry(glossaryMap, match[1], "import", lineNumber);
    }

    for (const match of line.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
      addEntry(glossaryMap, match[1], "constant", lineNumber);
    }

    addStringLabelEntries(glossaryMap, line, lineNumber);

    if (languageId === "python") {
      for (const match of line.matchAll(/\bdef\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
        addEntry(glossaryMap, match[1], "function", lineNumber);
      }

      addPythonAssignmentEntries(glossaryMap, line, lineNumber);
    }
  }

  if (glossaryMap.size < 10) {
    const fallbackTokens = sourceCode.match(/\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g) ?? [];

    for (const token of fallbackTokens) {
      addEntry(glossaryMap, token, "unknown", 0);
    }
  }

  return Array.from(glossaryMap.values())
    .sort((left, right) => right.references - left.references || left.term.localeCompare(right.term))
    .slice(0, maxEntries);
}

export function mergeGlossaryWithUserOverrides(
  generatedEntries: GlossaryEntry[],
  existingEntries: GlossaryEntry[]
): GlossaryEntry[] {
  const overrideMap = new Map(
    existingEntries
      .filter((entry) => entry.source === "user")
      .map((entry) => [entry.normalizedTerm, entry])
  );

  const mergedEntries = generatedEntries.map((entry) => {
    const overrideEntry = overrideMap.get(entry.normalizedTerm);

    if (!overrideEntry) {
      return entry;
    }

    return {
      ...entry,
      meaning: overrideEntry.meaning,
      source: "user" as const,
      updatedAt: overrideEntry.updatedAt
    };
  });

  for (const overrideEntry of overrideMap.values()) {
    if (!mergedEntries.find((entry) => entry.normalizedTerm === overrideEntry.normalizedTerm)) {
      mergedEntries.push(overrideEntry);
    }
  }

  return mergedEntries.sort(
    (left, right) => right.references - left.references || left.term.localeCompare(right.term)
  );
}
