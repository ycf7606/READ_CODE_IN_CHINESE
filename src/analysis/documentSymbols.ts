import * as vscode from "vscode";
import { GlossaryCategory } from "../contracts";
import {
  buildDocumentStructureFromSymbols,
  DocumentStructureResult,
  IndexedDocumentSymbol
} from "./documentStructure";

export {
  buildDocumentStructureFromSymbols,
  DocumentStructureResult,
  IndexedDocumentSymbol
} from "./documentStructure";

export async function loadDocumentStructureFromLsp(
  document: vscode.TextDocument
): Promise<DocumentStructureResult | undefined> {
  const rawSymbols = await vscode.commands.executeCommand<
    Array<vscode.DocumentSymbol | vscode.SymbolInformation> | undefined
  >("vscode.executeDocumentSymbolProvider", document.uri);

  if (!rawSymbols?.length) {
    return undefined;
  }

  const indexedSymbols = normalizeDocumentSymbols(rawSymbols);

  if (!indexedSymbols.length) {
    return undefined;
  }

  return buildDocumentStructureFromSymbols(indexedSymbols);
}

function normalizeDocumentSymbols(
  symbols: Array<vscode.DocumentSymbol | vscode.SymbolInformation>
): IndexedDocumentSymbol[] {
  if (!symbols.length) {
    return [];
  }

  if (symbols[0] instanceof vscode.DocumentSymbol) {
    return (symbols as vscode.DocumentSymbol[])
      .map((symbol) => normalizeHierarchicalSymbol(symbol))
      .filter((entry): entry is IndexedDocumentSymbol => Boolean(entry));
  }

  return (symbols as vscode.SymbolInformation[])
    .map((symbol) => normalizeFlatSymbol(symbol))
    .filter((entry): entry is IndexedDocumentSymbol => Boolean(entry));
}

function normalizeHierarchicalSymbol(
  symbol: vscode.DocumentSymbol
): IndexedDocumentSymbol | undefined {
  const category = mapSymbolKindToGlossaryCategory(symbol.kind);

  if (!category) {
    return undefined;
  }

  return {
    name: symbol.name,
    category,
    startLine: symbol.range.start.line + 1,
    endLine: symbol.range.end.line + 1,
    sourceLine: symbol.selectionRange.start.line + 1,
    children: symbol.children
      .map((child) => normalizeHierarchicalSymbol(child))
      .filter((entry): entry is IndexedDocumentSymbol => Boolean(entry))
  };
}

function normalizeFlatSymbol(
  symbol: vscode.SymbolInformation
): IndexedDocumentSymbol | undefined {
  const category = mapSymbolKindToGlossaryCategory(symbol.kind);

  if (!category) {
    return undefined;
  }

  return {
    name: symbol.name,
    category,
    startLine: symbol.location.range.start.line + 1,
    endLine: symbol.location.range.end.line + 1,
    sourceLine: symbol.location.range.start.line + 1,
    children: []
  };
}

function mapSymbolKindToGlossaryCategory(
  kind: vscode.SymbolKind
): GlossaryCategory | undefined {
  switch (kind) {
    case vscode.SymbolKind.Class:
      return "class";
    case vscode.SymbolKind.Method:
    case vscode.SymbolKind.Function:
    case vscode.SymbolKind.Constructor:
      return "function";
    case vscode.SymbolKind.Interface:
    case vscode.SymbolKind.Enum:
    case vscode.SymbolKind.TypeParameter:
    case vscode.SymbolKind.Struct:
      return "type";
    case vscode.SymbolKind.Variable:
    case vscode.SymbolKind.Field:
    case vscode.SymbolKind.Property:
      return "variable";
    case vscode.SymbolKind.Constant:
      return "constant";
    default:
      return undefined;
  }
}
