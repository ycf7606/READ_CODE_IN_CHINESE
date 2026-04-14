import ts from "typescript";
import { GlossaryCategory, GlossaryEntry } from "../contracts";

const SUPPORTED_TS_LANGUAGE_IDS = new Set([
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact"
]);

type ImportedAliasKind = "value" | "namespace";

interface ImportedAliasInfo {
  kind: ImportedAliasKind;
  categoryHint: Extract<GlossaryCategory, "function" | "class">;
}

export function extractTypeScriptAstGlossaryEntries(
  sourceCode: string,
  languageId: string,
  maxEntries = 80
): GlossaryEntry[] {
  if (!SUPPORTED_TS_LANGUAGE_IDS.has(languageId)) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    languageId.startsWith("javascript") ? "file.js" : "file.ts",
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    readScriptKind(languageId)
  );
  const entryMap = new Map<string, GlossaryEntry>();
  const importedAliases = new Map<string, ImportedAliasInfo>();

  const addEntry = (
    term: string,
    category: GlossaryCategory,
    position: number,
    references = 1
  ): void => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(term)) {
      return;
    }

    const normalizedTerm = term.toLowerCase();
    const sourceLine = sourceFile.getLineAndCharacterOfPosition(position).line + 1;
    const existingEntry = entryMap.get(normalizedTerm);

    if (existingEntry) {
      existingEntry.references += references;
      if (!existingEntry.sourceLine || sourceLine < existingEntry.sourceLine) {
        existingEntry.sourceLine = sourceLine;
      }
      if (existingEntry.category === "import" && category !== "import") {
        existingEntry.category = category;
        existingEntry.meaning = buildMeaning(term, category);
      }
      return;
    }

    entryMap.set(normalizedTerm, {
      term,
      normalizedTerm,
      meaning: buildMeaning(term, category),
      category,
      sourceLine,
      references,
      source: "generated",
      symbolOrigin: "external",
      updatedAt: new Date().toISOString()
    });
  };

  const registerImportedAlias = (
    localName: string,
    importedName?: string,
    kind: ImportedAliasKind = "value",
    position = 0
  ): void => {
    const categoryHint = /^[A-Z]/.test(importedName ?? localName) ? "class" : "function";
    importedAliases.set(localName.toLowerCase(), {
      kind,
      categoryHint
    });
    addEntry(localName, "import", position);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      if (node.importClause.name) {
        registerImportedAlias(node.importClause.name.text, node.importClause.name.text, "value", node.getStart(sourceFile));
      }

      const namedBindings = node.importClause.namedBindings;

      if (namedBindings && ts.isNamespaceImport(namedBindings)) {
        registerImportedAlias(
          namedBindings.name.text,
          namedBindings.name.text,
          "namespace",
          namedBindings.getStart(sourceFile)
        );
      } else if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          registerImportedAlias(
            element.name.text,
            element.propertyName?.text ?? element.name.text,
            "value",
            element.getStart(sourceFile)
          );
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const usage = readExternalUsage(node.expression, importedAliases, false);

      if (usage) {
        addEntry(usage.term, usage.category, node.expression.getStart(sourceFile));
      }
    }

    if (ts.isNewExpression(node) && node.expression) {
      const usage = readExternalUsage(node.expression, importedAliases, true);

      if (usage) {
        addEntry(usage.term, "class", node.expression.getStart(sourceFile));
      }
    }

    if (ts.canHaveDecorators(node)) {
      const decorators = ts.getDecorators(node) ?? [];

      for (const decorator of decorators) {
        const expression = ts.isCallExpression(decorator.expression)
          ? decorator.expression.expression
          : decorator.expression;
        const usage = readExternalUsage(expression, importedAliases, false);

        if (usage) {
          addEntry(usage.term, usage.category, expression.getStart(sourceFile));
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return Array.from(entryMap.values())
    .sort((left, right) => right.references - left.references || left.term.localeCompare(right.term))
    .slice(0, maxEntries);
}

function readExternalUsage(
  expression: ts.Expression,
  importedAliases: Map<string, ImportedAliasInfo>,
  preferClass: boolean
): { term: string; category: Extract<GlossaryCategory, "function" | "class"> } | undefined {
  if (ts.isIdentifier(expression)) {
    const importedAlias = importedAliases.get(expression.text.toLowerCase());

    if (!importedAlias || importedAlias.kind !== "value") {
      return undefined;
    }

    return {
      term: expression.text,
      category: preferClass ? "class" : importedAlias.categoryHint
    };
  }

  if (!ts.isPropertyAccessExpression(expression)) {
    return undefined;
  }

  const finalName = expression.name.text;
  const rootIdentifier = readRootIdentifier(expression.expression);

  if (!rootIdentifier) {
    return undefined;
  }

  const importedAlias = importedAliases.get(rootIdentifier.toLowerCase());

  if (!importedAlias) {
    return undefined;
  }

  return {
    term: finalName,
    category: preferClass || /^[A-Z]/.test(finalName) ? "class" : "function"
  };
}

function readRootIdentifier(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return readRootIdentifier(expression.expression);
  }

  if (ts.isCallExpression(expression)) {
    return readRootIdentifier(expression.expression);
  }

  return undefined;
}

function readScriptKind(languageId: string): ts.ScriptKind {
  switch (languageId) {
    case "javascript":
      return ts.ScriptKind.JS;
    case "javascriptreact":
      return ts.ScriptKind.JSX;
    case "typescriptreact":
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function buildMeaning(term: string, category: GlossaryCategory): string {
  switch (category) {
    case "class":
      return `External class or constructor related to ${term}.`;
    case "function":
      return `External function or decorator related to ${term}.`;
    default:
      return `Imported symbol related to ${term}.`;
  }
}
