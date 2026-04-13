import {
  GlossaryCategory,
  GlossaryEntry
} from "../contracts";
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
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(term) || COMMON_KEYWORDS.has(term)) {
    return;
  }

  const normalizedTerm = term.toLowerCase();
  const existingEntry = map.get(normalizedTerm);

  if (existingEntry) {
    existingEntry.references += 1;
    return;
  }

  map.set(normalizedTerm, {
    term,
    normalizedTerm,
    meaning: buildMeaning(term, category),
    category,
    sourceLine,
    references: 1,
    source: "generated",
    updatedAt: new Date().toISOString()
  });
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

    for (const match of line.matchAll(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
      addEntry(glossaryMap, match[1], "function", lineNumber);
    }

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

    if (languageId === "python") {
      for (const match of line.matchAll(/\bdef\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
        addEntry(glossaryMap, match[1], "function", lineNumber);
      }
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
