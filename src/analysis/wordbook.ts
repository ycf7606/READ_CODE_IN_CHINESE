import { PreprocessedSymbolEntry } from "../contracts";

type ScopeKind = "class" | "function";

interface ScopeRegion {
  label: string;
  kind: ScopeKind;
  startLine: number;
  endLine: number;
  path: string[];
}

interface PythonScopeRegion extends ScopeRegion {
  indent: number;
}

interface BraceScopeRegion extends ScopeRegion {
  bodyDepth: number;
}

const METHOD_NAME_EXCLUSIONS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "return",
  "constructor"
]);

export function attachWordbookScopePaths(
  entries: PreprocessedSymbolEntry[],
  sourceCode: string,
  languageId: string
): PreprocessedSymbolEntry[] {
  if (!entries.length || !sourceCode.trim()) {
    return entries;
  }

  const scopes = collectScopeRegions(sourceCode, languageId);

  if (!scopes.length) {
    return entries;
  }

  return entries.map((entry) => ({
    ...entry,
    scopePath: findScopePath(entry.sourceLine, scopes)
  }));
}

function collectScopeRegions(sourceCode: string, languageId: string): ScopeRegion[] {
  const lines = sourceCode.split(/\r?\n/);

  if (languageId === "python") {
    return collectPythonScopeRegions(lines);
  }

  return collectBraceScopeRegions(lines);
}

function collectPythonScopeRegions(lines: string[]): ScopeRegion[] {
  const scopes: PythonScopeRegion[] = [];
  const stack: PythonScopeRegion[] = [];

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const indent = readIndentWidth(line);

    while (stack.length && indent <= stack[stack.length - 1].indent) {
      const scope = stack.pop();

      if (scope) {
        scope.endLine = lineNumber - 1;
      }
    }

    const matchedScope = matchPythonScope(trimmedLine);

    if (!matchedScope) {
      continue;
    }

    const label = formatScopeLabel(matchedScope.kind, matchedScope.name);
    const scope: PythonScopeRegion = {
      label,
      kind: matchedScope.kind,
      startLine: lineNumber,
      endLine: lines.length,
      path: [...stack.map((entry) => entry.label), label],
      indent
    };

    scopes.push(scope);
    stack.push(scope);
  }

  while (stack.length) {
    const scope = stack.pop();

    if (scope) {
      scope.endLine = lines.length;
    }
  }

  return scopes;
}

function collectBraceScopeRegions(lines: string[]): ScopeRegion[] {
  const scopes: BraceScopeRegion[] = [];
  const stack: BraceScopeRegion[] = [];
  let braceDepth = 0;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const openCount = countOccurrences(line, "{");
    const closeCount = countOccurrences(line, "}");
    const matchedScope = matchBraceScope(
      line.trim(),
      stack.length > 0 && stack[stack.length - 1].kind === "class"
    );
    const nextDepth = Math.max(0, braceDepth + openCount - closeCount);

    if (matchedScope && openCount > closeCount) {
      const label = formatScopeLabel(matchedScope.kind, matchedScope.name);
      const scope: BraceScopeRegion = {
        label,
        kind: matchedScope.kind,
        startLine: lineNumber,
        endLine: lines.length,
        path: [...stack.map((entry) => entry.label), label],
        bodyDepth: nextDepth
      };

      scopes.push(scope);
      stack.push(scope);
    }

    braceDepth = nextDepth;

    while (stack.length && braceDepth < stack[stack.length - 1].bodyDepth) {
      const scope = stack.pop();

      if (scope) {
        scope.endLine = lineNumber;
      }
    }
  }

  while (stack.length) {
    const scope = stack.pop();

    if (scope) {
      scope.endLine = lines.length;
    }
  }

  return scopes;
}

function matchPythonScope(
  trimmedLine: string
): { kind: ScopeKind; name: string } | undefined {
  const classMatch = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(trimmedLine);

  if (classMatch) {
    return {
      kind: "class",
      name: classMatch[1]
    };
  }

  const functionMatch = /^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(trimmedLine);

  if (functionMatch) {
    return {
      kind: "function",
      name: functionMatch[1]
    };
  }

  return undefined;
}

function matchBraceScope(
  trimmedLine: string,
  insideClass: boolean
): { kind: ScopeKind; name: string } | undefined {
  if (!trimmedLine || trimmedLine.startsWith("//") || trimmedLine.startsWith("*")) {
    return undefined;
  }

  const classMatch = /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/.exec(
    trimmedLine
  );

  if (classMatch) {
    return {
      kind: "class",
      name: classMatch[1]
    };
  }

  const functionMatch = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/.exec(
    trimmedLine
  );

  if (functionMatch) {
    return {
      kind: "function",
      name: functionMatch[1]
    };
  }

  const functionExpressionMatch =
    /^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?function\b/.exec(
      trimmedLine
    );

  if (functionExpressionMatch) {
    return {
      kind: "function",
      name: functionExpressionMatch[1]
    };
  }

  const arrowFunctionMatch =
    /^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/.exec(
      trimmedLine
    );

  if (arrowFunctionMatch) {
    return {
      kind: "function",
      name: arrowFunctionMatch[1]
    };
  }

  if (!insideClass) {
    return undefined;
  }

  const methodMatch =
    /^(?:(?:public|private|protected|static|async|override|get|set|readonly)\s+)*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/.exec(
      trimmedLine
    );

  if (!methodMatch) {
    return undefined;
  }

  const methodName = methodMatch[1];

  if (METHOD_NAME_EXCLUSIONS.has(methodName)) {
    return undefined;
  }

  return {
    kind: "function",
    name: methodName
  };
}

function findScopePath(sourceLine: number, scopes: ScopeRegion[]): string[] | undefined {
  if (sourceLine <= 0) {
    return undefined;
  }

  let matchedScope: ScopeRegion | undefined;

  for (const scope of scopes) {
    if (scope.startLine <= sourceLine && sourceLine <= scope.endLine) {
      if (!matchedScope || scope.path.length > matchedScope.path.length) {
        matchedScope = scope;
      }
    }
  }

  return matchedScope?.path;
}

function formatScopeLabel(kind: ScopeKind, name: string): string {
  return `${kind} ${name}`;
}

function readIndentWidth(line: string): number {
  let width = 0;

  for (const character of line) {
    if (character === " ") {
      width += 1;
      continue;
    }

    if (character === "\t") {
      width += 4;
      continue;
    }

    break;
  }

  return width;
}

function countOccurrences(input: string, token: string): number {
  return input.split(token).length - 1;
}
