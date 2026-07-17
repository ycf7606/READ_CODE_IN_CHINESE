import { PreprocessedSymbolCandidate } from "../contracts";
import { createContentHash } from "../utils/hash";

const DEFAULT_CONTEXT_LIMIT = 16_000;
const MAX_DEFINITION_SCOPE_LINES = 80;

export function buildPreprocessSourceContext(
  sourceCode: string,
  candidates: PreprocessedSymbolCandidate[],
  maxLength = DEFAULT_CONTEXT_LIMIT
): string {
  const sections = candidates.map((candidate) => buildCandidateContext(sourceCode, candidate));
  const context = sections.join("\n\n");

  if (context.length <= maxLength || sections.length === 0) {
    return context;
  }

  const separatorBudget = Math.max(0, (sections.length - 1) * 2);
  const availableBudget = Math.max(sections.length, maxLength - separatorBudget);
  const perSectionBudget = Math.max(1, Math.floor(availableBudget / sections.length));
  let remainder = Math.max(0, availableBudget - perSectionBudget * sections.length);

  return sections
    .map((section) => {
      const sectionBudget = perSectionBudget + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      return truncateContextSection(section, sectionBudget);
    })
    .join("\n\n")
    .slice(0, maxLength);
}

export function createCandidateContextHash(
  sourceCode: string,
  candidate: PreprocessedSymbolCandidate
): string {
  return createContentHash(
    [candidate.normalizedTerm, candidate.category, buildCandidateContext(sourceCode, candidate)].join(
      "\n"
    )
  );
}

function buildCandidateContext(
  sourceCode: string,
  candidate: PreprocessedSymbolCandidate
): string {
  const lines = sourceCode.split(/\r?\n/);
  const padding =
    candidate.category === "function" || candidate.category === "class" ? 5 : 2;
  const selectedLines = new Set<number>();
  const definitionIndex = candidate.sourceLine - 1;

  addWindow(selectedLines, definitionIndex, padding, lines.length);
  addDefinitionScope(selectedLines, lines, definitionIndex, candidate.category);

  const termPattern = new RegExp(`\\b${escapeRegExp(candidate.term)}\\b`);
  let referenceWindows = 0;

  for (const [index, line] of lines.entries()) {
    if (index === definitionIndex || !termPattern.test(line)) {
      continue;
    }

    addWindow(selectedLines, index, 1, lines.length);
    referenceWindows += 1;

    if (referenceWindows >= 3) {
      break;
    }
  }

  const excerpts = Array.from(selectedLines)
    .sort((left, right) => left - right)
    .map((index) => `${index + 1}: ${lines[index] ?? ""}`)
    .join("\n");

  return [
    `### ${candidate.term}`,
    `category=${candidate.category} definitionLine=${candidate.sourceLine} references=${candidate.references}`,
    excerpts || "(no source excerpt available)"
  ].join("\n");
}

function addDefinitionScope(
  selectedLines: Set<number>,
  lines: string[],
  definitionIndex: number,
  category: PreprocessedSymbolCandidate["category"]
): void {
  if (definitionIndex < 0 || definitionIndex >= lines.length) {
    return;
  }

  const definitionLine = lines[definitionIndex] ?? "";

  if (category === "function" || category === "class") {
    if (/^\s*(?:async\s+def|def|class)\b.*:\s*(?:#.*)?$/.test(definitionLine)) {
      addPythonIndentedScope(selectedLines, lines, definitionIndex);
      return;
    }

    if (addBraceScope(selectedLines, lines, definitionIndex)) {
      return;
    }
  }

  addMultilineStatement(selectedLines, lines, definitionIndex);
}

function addPythonIndentedScope(
  selectedLines: Set<number>,
  lines: string[],
  definitionIndex: number
): void {
  const baseIndent = getIndentWidth(lines[definitionIndex] ?? "");
  const endIndex = Math.min(
    lines.length - 1,
    definitionIndex + MAX_DEFINITION_SCOPE_LINES - 1
  );

  for (let index = definitionIndex; index <= endIndex; index += 1) {
    const line = lines[index] ?? "";

    if (
      index > definitionIndex &&
      line.trim() &&
      getIndentWidth(line) <= baseIndent &&
      !/^\s*#/.test(line)
    ) {
      break;
    }

    selectedLines.add(index);
  }
}

function addBraceScope(
  selectedLines: Set<number>,
  lines: string[],
  definitionIndex: number
): boolean {
  const endIndex = Math.min(
    lines.length - 1,
    definitionIndex + MAX_DEFINITION_SCOPE_LINES - 1
  );
  let braceBalance = 0;
  let foundOpeningBrace = false;

  for (let index = definitionIndex; index <= endIndex; index += 1) {
    const line = stripQuotedText(lines[index] ?? "");
    const openings = (line.match(/\{/g) ?? []).length;
    const closings = (line.match(/\}/g) ?? []).length;

    if (openings > 0) {
      foundOpeningBrace = true;
    }

    if (!foundOpeningBrace && index - definitionIndex >= 3) {
      return false;
    }

    selectedLines.add(index);
    braceBalance += openings - closings;

    if (foundOpeningBrace && braceBalance <= 0) {
      return true;
    }
  }

  return foundOpeningBrace;
}

function addMultilineStatement(
  selectedLines: Set<number>,
  lines: string[],
  definitionIndex: number
): void {
  let balance = 0;

  for (
    let index = definitionIndex;
    index < Math.min(lines.length, definitionIndex + 20);
    index += 1
  ) {
    const line = stripQuotedText(lines[index] ?? "");
    balance += (line.match(/[([{]/g) ?? []).length - (line.match(/[)\]}]/g) ?? []).length;
    selectedLines.add(index);

    if (index > definitionIndex && balance <= 0 && !/\\\s*$/.test(line)) {
      break;
    }
  }
}

function truncateContextSection(section: string, maxLength: number): string {
  if (section.length <= maxLength) {
    return section;
  }

  const marker = "\n... section truncated ...\n";

  if (maxLength <= marker.length + 16) {
    return section.slice(0, maxLength);
  }

  const remaining = maxLength - marker.length;
  const headLength = Math.ceil(remaining * 0.7);
  const tailLength = remaining - headLength;
  return `${section.slice(0, headLength)}${marker}${section.slice(-tailLength)}`;
}

function getIndentWidth(line: string): number {
  return line.match(/^\s*/)?.[0].replace(/\t/g, "    ").length ?? 0;
}

function stripQuotedText(line: string): string {
  return line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "");
}

function addWindow(
  target: Set<number>,
  centerIndex: number,
  padding: number,
  lineCount: number
): void {
  if (centerIndex < 0 || centerIndex >= lineCount) {
    return;
  }

  for (
    let index = Math.max(0, centerIndex - padding);
    index <= Math.min(lineCount - 1, centerIndex + padding);
    index += 1
  ) {
    target.add(index);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
