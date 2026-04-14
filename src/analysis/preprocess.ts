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
  beginner: 24,
  intermediate: 12,
  expert: 6
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

export function buildPreprocessCandidatePool(
  glossaryEntries: GlossaryEntry[]
): PreprocessedSymbolCandidate[] {
  return glossaryEntries
    .filter(
      (entry): entry is GlossaryEntry & { category: PreprocessedSymbolCategory } =>
        isPreprocessCategory(entry.category)
    )
    .filter((entry) => entry.sourceLine !== undefined && entry.sourceLine > 0)
    .map((entry) => ({
      term: entry.term,
      normalizedTerm: entry.normalizedTerm,
      category: entry.category as PreprocessedSymbolCategory,
      sourceLine: entry.sourceLine ?? 0,
      references: entry.references,
      score: scoreCandidate(entry)
    }))
    .sort((left, right) => {
      return (
        right.score - left.score ||
        left.sourceLine - right.sourceLine ||
        left.term.localeCompare(right.term)
      );
    });
}

export function selectPreprocessCandidatesFromPool(
  candidatePool: PreprocessedSymbolCandidate[],
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): PreprocessedSymbolCandidate[] {
  const limit = getPreprocessCandidateLimit(professionalLevel, occupation);

  return candidatePool
    .filter((entry) => keepCandidateForAudience(entry, professionalLevel, occupation))
    .slice(0, limit);
}

export function buildPreprocessCandidates(
  glossaryEntries: GlossaryEntry[],
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): PreprocessedSymbolCandidate[] {
  return selectPreprocessCandidatesFromPool(
    buildPreprocessCandidatePool(glossaryEntries),
    professionalLevel,
    occupation
  );
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
  entry: PreprocessedSymbolCandidate,
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
  entry: PreprocessedSymbolCandidate,
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
    professionalLevel === "intermediate" &&
    entry.references <= 2
  ) {
    return true;
  }

  if (
    (entry.category === "variable" || entry.category === "label") &&
    COMMON_VARIABLE_TERMS.has(normalizedTerm) &&
    professionalLevel === "intermediate" &&
    entry.references <= 2 &&
    occupation !== "student"
  ) {
    return true;
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

  return false;
}

function scoreCandidate(
  entry: PreprocessedSymbolCandidate | (GlossaryEntry & { category: PreprocessedSymbolCategory })
): number {
  const categoryWeight = CATEGORY_WEIGHT[entry.category];
  const nameComplexityWeight = /[A-Z_]/.test(entry.term) ? 6 : 0;
  const labelShapeWeight = entry.category === "label" && /[-_]/.test(entry.term) ? 4 : 0;
  const sourceLineWeight = entry.sourceLine ? Math.max(0, 12 - Math.min(entry.sourceLine, 12)) : 0;

  return categoryWeight + entry.references * 6 + nameComplexityWeight + labelShapeWeight + sourceLineWeight;
}
