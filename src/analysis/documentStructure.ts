import { GlossaryCategory, GlossaryEntry } from "../contracts";
import { WordbookScopeRegion } from "./wordbook";

export interface IndexedDocumentSymbol {
  name: string;
  category: GlossaryCategory;
  startLine: number;
  endLine: number;
  sourceLine: number;
  children: IndexedDocumentSymbol[];
}

export interface DocumentStructureResult {
  glossaryEntries: GlossaryEntry[];
  scopeRegions: WordbookScopeRegion[];
}

export function buildDocumentStructureFromSymbols(
  symbols: IndexedDocumentSymbol[]
): DocumentStructureResult {
  const glossaryEntries: GlossaryEntry[] = [];
  const scopeRegions: WordbookScopeRegion[] = [];

  for (const symbol of symbols) {
    collectDocumentStructure(symbol, glossaryEntries, scopeRegions, []);
  }

  return {
    glossaryEntries,
    scopeRegions
  };
}

function collectDocumentStructure(
  symbol: IndexedDocumentSymbol,
  glossaryEntries: GlossaryEntry[],
  scopeRegions: WordbookScopeRegion[],
  scopePath: string[]
): void {
  const currentScopePath = [...scopePath];

  if (symbol.category === "class" || symbol.category === "function") {
    const label = `${symbol.category} ${symbol.name}`;
    currentScopePath.push(label);
    scopeRegions.push({
      label,
      kind: symbol.category,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      path: [...currentScopePath]
    });
  }

  glossaryEntries.push({
    term: symbol.name,
    normalizedTerm: symbol.name.toLowerCase(),
    meaning: buildSymbolMeaning(symbol.name, symbol.category),
    category: symbol.category,
    sourceLine: symbol.sourceLine,
    references: 2,
    source: "generated",
    symbolOrigin: "local",
    scopePath: currentScopePath.length ? [...currentScopePath] : undefined,
    updatedAt: new Date().toISOString()
  });

  for (const child of symbol.children) {
    collectDocumentStructure(child, glossaryEntries, scopeRegions, currentScopePath);
  }
}

function buildSymbolMeaning(term: string, category: GlossaryCategory): string {
  switch (category) {
    case "function":
      return `Function or method named ${term} defined in the current file.`;
    case "class":
      return `Class named ${term} defined in the current file.`;
    case "type":
      return `Type-like symbol named ${term} defined in the current file.`;
    case "constant":
      return `Constant named ${term} defined in the current file.`;
    default:
      return `Variable or field named ${term} defined in the current file.`;
  }
}
