import { GlossaryCategory, GlossaryEntry, SymbolOrigin } from "../contracts";
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

type ImportedAliasKind = "function" | "class" | "namespace";

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
  sourceLine: number,
  symbolOrigin: SymbolOrigin = "local",
  scopePath?: string[]
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
    if (existingEntry.symbolOrigin !== "local" && symbolOrigin === "local") {
      existingEntry.symbolOrigin = "local";
    }
    if ((!existingEntry.scopePath || existingEntry.scopePath.length === 0) && scopePath?.length) {
      existingEntry.scopePath = [...scopePath];
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
    symbolOrigin,
    scopePath: scopePath?.length ? [...scopePath] : undefined,
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
    addEntry(map, match[1], "label", lineNumber, "local");
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
    addEntry(map, match[1], "variable", lineNumber, "local");
  }

  for (const match of line.matchAll(/\b(?:self|cls)\.([A-Za-z_][A-Za-z0-9_]*)\s*=/g)) {
    addEntry(map, match[1], "variable", lineNumber, "local");
  }
}

function addMemberFunctionEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number
): void {
  for (const match of line.matchAll(/\b(?:this|self|cls)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    addEntry(map, match[1], "function", lineNumber, "local");
  }
}

function addQualifiedCallEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number
): void {
  for (const match of line.matchAll(
    /(?:\b[A-Za-z_][A-Za-z0-9_]*\.)+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g
  )) {
    const term = match[1];
    const category = /^[A-Z]/.test(term) ? "class" : "function";
    addEntry(map, term, category, lineNumber, "external");
  }
}

function addImportEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number,
  languageId: string,
  importedAliases: Map<string, ImportedAliasKind>
): void {
  for (const match of line.matchAll(/\bimport\s+([A-Za-z_][A-Za-z0-9_]*)\s+from\b/g)) {
    addEntry(map, match[1], "import", lineNumber, "external");
    registerImportedAlias(importedAliases, match[1]);
  }

  for (const match of line.matchAll(/\bimport\s+\*\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
    addEntry(map, match[1], "import", lineNumber, "external");
    registerImportedAlias(importedAliases, match[1], match[1], "namespace");
  }

  for (const match of line.matchAll(/\bimport\s*\{([^}]*)\}/g)) {
    const clause = match[1];

    for (const part of clause.split(",")) {
      const trimmedPart = part.trim();

      if (!trimmedPart) {
        continue;
      }

      const aliasMatch = /\bas\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(trimmedPart);
      const directMatch = /^([A-Za-z_][A-Za-z0-9_]*)$/.exec(trimmedPart);
      const term = aliasMatch?.[1] ?? directMatch?.[1];

      if (term) {
        addEntry(map, term, "import", lineNumber, "external");
        registerImportedAlias(importedAliases, term, directMatch?.[1] ?? term);
      }
    }
  }

  if (languageId === "python") {
    for (const match of line.matchAll(
      /\bimport\s+([A-Za-z_][A-Za-z0-9_.]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?/g
    )) {
      const importedModule = match[1].split(".").pop() ?? match[1];
      const alias = match[2] ?? importedModule;
      addEntry(map, alias, "import", lineNumber, "external");
      registerImportedAlias(importedAliases, alias, importedModule, "namespace");
    }

    for (const match of line.matchAll(/\bfrom\s+[A-Za-z_][A-Za-z0-9_.]*\s+import\s+(.+)$/g)) {
      const clause = match[1];

      for (const part of clause.split(",")) {
        const trimmedPart = part.trim();

        if (!trimmedPart) {
          continue;
        }

        const aliasMatch = /\bas\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(trimmedPart);
        const directMatch = /^([A-Za-z_][A-Za-z0-9_]*)$/.exec(trimmedPart);
        const term = aliasMatch?.[1] ?? directMatch?.[1];

        if (term) {
          addEntry(map, term, "import", lineNumber, "external");
          registerImportedAlias(importedAliases, term, directMatch?.[1] ?? term);
        }
      }
    }
  }
}

function registerImportedAlias(
  importedAliases: Map<string, ImportedAliasKind>,
  localName: string,
  originalName?: string,
  kind: ImportedAliasKind = "function"
): void {
  importedAliases.set(
    localName.toLowerCase(),
    kind === "namespace"
      ? "namespace"
      : /^[A-Z]/.test(originalName ?? localName)
        ? "class"
        : "function"
  );
}

function addImportedAliasUsageEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number,
  importedAliases: Map<string, ImportedAliasKind>
): void {
  for (const match of line.matchAll(/\bnew\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const term = match[1];

    if (importedAliases.has(term.toLowerCase())) {
      addEntry(map, term, "class", lineNumber, "external");
    }
  }

  for (const match of line.matchAll(/(?:^|[^.\w])([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const term = match[1];
    const aliasKind = importedAliases.get(term.toLowerCase());

    if (!aliasKind || aliasKind === "namespace") {
      continue;
    }

    addEntry(map, term, aliasKind === "class" ? "class" : "function", lineNumber, "external");
  }
}

function addDecoratorEntries(
  map: Map<string, GlossaryEntry>,
  line: string,
  lineNumber: number,
  importedAliases: Map<string, ImportedAliasKind>
): void {
  const decoratorMatch =
    /^\s*@((?:[A-Za-z_][A-Za-z0-9_]*\.)*[A-Za-z_][A-Za-z0-9_]*)/.exec(line);

  if (!decoratorMatch) {
    return;
  }

  const fullDecoratorName = decoratorMatch[1];
  const segments = fullDecoratorName.split(".");
  const rootSegment = segments[0];
  const finalSegment = segments[segments.length - 1];

  if (segments.length > 1 || importedAliases.has(rootSegment.toLowerCase())) {
    addEntry(
      map,
      finalSegment,
      /^[A-Z]/.test(finalSegment) ? "class" : "function",
      lineNumber,
      "external"
    );
    return;
  }

  const aliasKind = importedAliases.get(finalSegment.toLowerCase());

  if (aliasKind) {
    addEntry(
      map,
      finalSegment,
      aliasKind === "class" ? "class" : "function",
      lineNumber,
      "external"
    );
  }
}

export function extractGlossaryEntries(
  sourceCode: string,
  languageId: string,
  maxEntries = 60
): GlossaryEntry[] {
  const glossaryMap = new Map<string, GlossaryEntry>();
  const importedAliases = new Map<string, ImportedAliasKind>();
  const lines = sourceCode.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    for (const match of line.matchAll(/\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
      addEntry(glossaryMap, match[1], "variable", lineNumber, "local");
    }

    for (const match of line.matchAll(/\b(?:this|self)\.([A-Za-z_][A-Za-z0-9_]*)\s*=/g)) {
      addEntry(glossaryMap, match[1], "variable", lineNumber, "local");
    }

    for (const match of line.matchAll(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
      addEntry(glossaryMap, match[1], "function", lineNumber, "local");
    }

    addMemberFunctionEntries(glossaryMap, line, lineNumber);
    addDecoratorEntries(glossaryMap, line, lineNumber, importedAliases);
    addQualifiedCallEntries(glossaryMap, line, lineNumber);
    addImportedAliasUsageEntries(glossaryMap, line, lineNumber, importedAliases);

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

      addEntry(glossaryMap, match[1], category, lineNumber, "local");
    }

    addImportEntries(glossaryMap, line, lineNumber, languageId, importedAliases);

    for (const match of line.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
      addEntry(glossaryMap, match[1], "constant", lineNumber, "local");
    }

    addStringLabelEntries(glossaryMap, line, lineNumber);

    if (languageId === "python") {
      for (const match of line.matchAll(/\bdef\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
        addEntry(glossaryMap, match[1], "function", lineNumber, "local");
      }

      addPythonAssignmentEntries(glossaryMap, line, lineNumber);
    }
  }

  if (glossaryMap.size < 10) {
    const fallbackTokens = sourceCode.match(/\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g) ?? [];

    for (const token of fallbackTokens) {
      addEntry(glossaryMap, token, "unknown", 0, "local");
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

export function mergeGeneratedGlossaryEntries(
  ...entryCollections: GlossaryEntry[][]
): GlossaryEntry[] {
  const mergedEntryMap = new Map<string, GlossaryEntry>();

  for (const entries of entryCollections) {
    for (const entry of entries) {
      const existingEntry = mergedEntryMap.get(entry.normalizedTerm);

      if (!existingEntry) {
        mergedEntryMap.set(entry.normalizedTerm, {
          ...entry,
          scopePath: entry.scopePath?.length ? [...entry.scopePath] : undefined
        });
        continue;
      }

      existingEntry.references += entry.references;

      if (!existingEntry.sourceLine && entry.sourceLine) {
        existingEntry.sourceLine = entry.sourceLine;
      }

      if (CATEGORY_PRIORITY[entry.category] > CATEGORY_PRIORITY[existingEntry.category]) {
        existingEntry.category = entry.category;
        existingEntry.meaning = buildMeaning(existingEntry.term, entry.category);
      }

      if (existingEntry.symbolOrigin !== "local" && entry.symbolOrigin === "local") {
        existingEntry.symbolOrigin = "local";
      }

      if ((!existingEntry.scopePath || existingEntry.scopePath.length === 0) && entry.scopePath?.length) {
        existingEntry.scopePath = [...entry.scopePath];
      }
    }
  }

  return Array.from(mergedEntryMap.values()).sort(
    (left, right) => right.references - left.references || left.term.localeCompare(right.term)
  );
}
