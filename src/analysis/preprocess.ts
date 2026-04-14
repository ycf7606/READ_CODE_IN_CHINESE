import {
  GlossaryEntry,
  Occupation,
  PreprocessedSymbolCandidate,
  PreprocessedSymbolCategory,
  ProfessionalLevel
} from "../contracts";

const CATEGORY_WEIGHT: Record<PreprocessedSymbolCategory, number> = {
  function: 48,
  class: 40,
  type: 34,
  variable: 24,
  label: 20
};

const PROFESSIONAL_BASE_LIMIT: Record<ProfessionalLevel, number> = {
  beginner: 26,
  intermediate: 16,
  expert: 8
};

const OCCUPATION_LIMIT_DELTA: Record<Occupation, number> = {
  student: 6,
  developer: 0,
  "data-scientist": 4,
  researcher: 3,
  maintainer: 2
};

const COMMON_FUNCTION_TERMS = new Set([
  "forward",
  "backward",
  "fit",
  "predict",
  "transform",
  "main",
  "setup",
  "teardown",
  "render",
  "update",
  "train",
  "eval",
  "load",
  "save",
  "run",
  "call",
  "__call__",
  "__init__"
]);

const COMMON_VARIABLE_TERMS = new Set([
  "input",
  "inputs",
  "output",
  "outputs",
  "data",
  "value",
  "values",
  "item",
  "items",
  "result",
  "results",
  "label",
  "labels",
  "name",
  "names",
  "type",
  "types",
  "target",
  "targets",
  "temp",
  "tmp"
]);

export function buildPreprocessCandidates(
  glossaryEntries: GlossaryEntry[],
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): PreprocessedSymbolCandidate[] {
  const limit = getPreprocessCandidateLimit(professionalLevel, occupation);

  return glossaryEntries
    .filter((entry) => isPreprocessCategory(entry.category))
    .filter((entry) => entry.sourceLine && entry.sourceLine > 0)
    .filter((entry) => keepCandidateForAudience(entry, professionalLevel, occupation))
    .map((entry) => ({
      term: entry.term,
      normalizedTerm: entry.normalizedTerm,
      category: entry.category as PreprocessedSymbolCategory,
      sourceLine: entry.sourceLine ?? 0,
      references: entry.references,
      score: scoreCandidate(entry, occupation)
    }))
    .sort((left, right) => {
      return (
        right.score - left.score ||
        left.sourceLine - right.sourceLine ||
        left.term.localeCompare(right.term)
      );
    })
    .slice(0, limit);
}

export function getPreprocessCandidateLimit(
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): number {
  return Math.max(
    6,
    PROFESSIONAL_BASE_LIMIT[professionalLevel] + OCCUPATION_LIMIT_DELTA[occupation]
  );
}

function isPreprocessCategory(
  category: GlossaryEntry["category"]
): category is PreprocessedSymbolCategory {
  return (
    category === "variable" ||
    category === "function" ||
    category === "class" ||
    category === "type" ||
    category === "label"
  );
}

function keepCandidateForAudience(
  entry: GlossaryEntry,
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): boolean {
  if (isTooCommonForAudience(entry, professionalLevel, occupation)) {
    return false;
  }

  if (entry.category === "function" || entry.category === "class" || entry.category === "type") {
    return true;
  }

  if (entry.category === "label") {
    if (professionalLevel === "beginner") {
      return entry.term.length > 1;
    }

    if (professionalLevel === "intermediate") {
      return entry.references > 0 || /[A-Z_-]/.test(entry.term);
    }

    return entry.references > 1 || /[A-Z_-]/.test(entry.term);
  }

  if (professionalLevel === "beginner") {
    return entry.term.length > 1;
  }

  if (professionalLevel === "intermediate") {
    return entry.references > 1 || /[A-Z_]/.test(entry.term) || entry.term.length > 3;
  }

  return entry.references > 1 && (/[A-Z_]/.test(entry.term) || entry.term.length > 4);
}

function isTooCommonForAudience(
  entry: GlossaryEntry,
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): boolean {
  const normalizedTerm = entry.normalizedTerm;

  if (professionalLevel === "beginner") {
    return false;
  }

  if (
    entry.category === "function" &&
    COMMON_FUNCTION_TERMS.has(normalizedTerm) &&
    professionalLevel === "expert"
  ) {
    return true;
  }

  if (
    (entry.category === "variable" || entry.category === "label") &&
    COMMON_VARIABLE_TERMS.has(normalizedTerm) &&
    professionalLevel === "expert"
  ) {
    return true;
  }

  if (
    professionalLevel === "intermediate" &&
    entry.category === "function" &&
    COMMON_FUNCTION_TERMS.has(normalizedTerm) &&
    entry.references <= 1 &&
    occupation !== "student"
  ) {
    return true;
  }

  if (
    professionalLevel === "intermediate" &&
    (entry.category === "variable" || entry.category === "label") &&
    COMMON_VARIABLE_TERMS.has(normalizedTerm) &&
    entry.references <= 2 &&
    occupation === "developer"
  ) {
    return true;
  }

  return false;
}

function scoreCandidate(entry: GlossaryEntry, occupation: Occupation): number {
  const categoryWeight = isPreprocessCategory(entry.category)
    ? CATEGORY_WEIGHT[entry.category]
    : 0;
  const nameComplexityWeight = /[A-Z_]/.test(entry.term) ? 6 : 0;
  const labelShapeWeight = entry.category === "label" && /[-_]/.test(entry.term) ? 4 : 0;
  const sourceLineWeight = entry.sourceLine ? Math.max(0, 12 - Math.min(entry.sourceLine, 12)) : 0;
  const occupationBoost =
    occupation === "student" && (entry.category === "variable" || entry.category === "label")
      ? 4
      : occupation === "data-scientist" && (entry.category === "label" || entry.category === "type")
        ? 4
        : 0;

  return (
    categoryWeight +
    entry.references * 6 +
    nameComplexityWeight +
    labelShapeWeight +
    sourceLineWeight +
    occupationBoost
  );
}
