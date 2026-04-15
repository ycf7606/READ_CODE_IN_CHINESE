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

const RETENTION_RATIO: Record<ProfessionalLevel, number> = {
  beginner: 1,
  intermediate: 0.85,
  expert: 0.7
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
      category: entry.category,
      sourceLine: entry.sourceLine ?? 0,
      references: entry.references,
      score: scoreCandidate(entry)
    }))
    .sort(compareCandidateOrder);
}

export function selectPreprocessCandidatesFromPool(
  candidatePool: PreprocessedSymbolCandidate[],
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): PreprocessedSymbolCandidate[] {
  const targetCount = getPreprocessTargetSelectionCount(
    candidatePool.length,
    professionalLevel
  );

  return rankPreprocessCandidatesForAudience(candidatePool, professionalLevel, occupation).slice(
    0,
    targetCount
  );
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

export function getPreprocessRetentionRatio(
  professionalLevel: ProfessionalLevel
): number {
  return RETENTION_RATIO[professionalLevel];
}

export function getPreprocessTargetSelectionCount(
  candidateCount: number,
  professionalLevel: ProfessionalLevel
): number {
  if (candidateCount <= 0) {
    return 0;
  }

  if (professionalLevel === "beginner") {
    return candidateCount;
  }

  return Math.min(candidateCount, Math.max(1, Math.ceil(candidateCount * RETENTION_RATIO[professionalLevel])));
}

export function rankPreprocessCandidatesForAudience(
  candidatePool: PreprocessedSymbolCandidate[],
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): PreprocessedSymbolCandidate[] {
  return [...candidatePool].sort((left, right) => {
    const scoreDifference =
      scoreCandidateForAudience(right, professionalLevel, occupation) -
      scoreCandidateForAudience(left, professionalLevel, occupation);

    return scoreDifference || compareCandidateOrder(left, right);
  });
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

function scoreCandidateForAudience(
  entry: PreprocessedSymbolCandidate,
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): number {
  if (professionalLevel === "beginner") {
    return entry.score;
  }

  let adjustedScore = entry.score;
  const commonPenaltyMultiplier = occupation === "student" ? 0.6 : 1;

  if (entry.category === "function" && COMMON_FUNCTION_TERMS.has(entry.normalizedTerm)) {
    adjustedScore -= professionalLevel === "intermediate" ? 18 * commonPenaltyMultiplier : 28;
  }

  if (
    (entry.category === "variable" || entry.category === "label") &&
    COMMON_VARIABLE_TERMS.has(entry.normalizedTerm)
  ) {
    adjustedScore -= professionalLevel === "intermediate" ? 16 * commonPenaltyMultiplier : 24;
  }

  if (entry.term.length <= 2) {
    adjustedScore -= professionalLevel === "intermediate" ? 10 : 16;
  }

  if (entry.category === "label" && !/[A-Z_-]/.test(entry.term)) {
    adjustedScore -= professionalLevel === "intermediate" ? 6 : 10;
  }

  return adjustedScore;
}

function scoreCandidate(
  entry: PreprocessedSymbolCandidate | (GlossaryEntry & { category: PreprocessedSymbolCategory })
): number {
  const categoryWeight = CATEGORY_WEIGHT[entry.category];
  const nameComplexityWeight = /[A-Z_]/.test(entry.term) ? 6 : 0;
  const labelShapeWeight = entry.category === "label" && /[-_]/.test(entry.term) ? 4 : 0;
  const sourceLineWeight = entry.sourceLine ? Math.max(0, 12 - Math.min(entry.sourceLine, 12)) : 0;

  return (
    categoryWeight +
    entry.references * 6 +
    nameComplexityWeight +
    labelShapeWeight +
    sourceLineWeight
  );
}

function compareCandidateOrder(
  left: PreprocessedSymbolCandidate,
  right: PreprocessedSymbolCandidate
): number {
  return (
    right.score - left.score ||
    left.sourceLine - right.sourceLine ||
    left.term.localeCompare(right.term)
  );
}
