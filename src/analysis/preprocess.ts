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
  variable: 22
};

const PROFESSION_BASE_LIMIT: Record<ProfessionalLevel, number> = {
  beginner: 24,
  intermediate: 14,
  expert: 8
};

const OCCUPATION_LIMIT_DELTA: Record<Occupation, number> = {
  student: 6,
  developer: 0,
  "data-scientist": 4,
  researcher: 3,
  maintainer: 2
};

export function buildPreprocessCandidates(
  glossaryEntries: GlossaryEntry[],
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): PreprocessedSymbolCandidate[] {
  const limit = getPreprocessCandidateLimit(professionalLevel, occupation);

  return glossaryEntries
    .filter((entry) => isPreprocessCategory(entry.category))
    .filter((entry) => entry.sourceLine && entry.sourceLine > 0)
    .filter((entry) => keepCandidateForAudience(entry, professionalLevel))
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
    })
    .slice(0, limit);
}

export function getPreprocessCandidateLimit(
  professionalLevel: ProfessionalLevel,
  occupation: Occupation
): number {
  return Math.max(
    6,
    PROFESSION_BASE_LIMIT[professionalLevel] + OCCUPATION_LIMIT_DELTA[occupation]
  );
}

function isPreprocessCategory(
  category: GlossaryEntry["category"]
): category is PreprocessedSymbolCategory {
  return (
    category === "variable" ||
    category === "function" ||
    category === "class" ||
    category === "type"
  );
}

function keepCandidateForAudience(
  entry: GlossaryEntry,
  professionalLevel: ProfessionalLevel
): boolean {
  if (entry.category === "function" || entry.category === "class" || entry.category === "type") {
    return true;
  }

  if (professionalLevel === "beginner") {
    return entry.term.length > 1;
  }

  if (professionalLevel === "intermediate") {
    return entry.references > 1 || entry.term.length > 3;
  }

  return entry.references > 1 && entry.term.length > 3;
}

function scoreCandidate(entry: GlossaryEntry): number {
  const categoryWeight = isPreprocessCategory(entry.category)
    ? CATEGORY_WEIGHT[entry.category]
    : 0;
  const nameComplexityWeight = /[A-Z_]/.test(entry.term) ? 5 : 0;
  const sourceLineWeight = entry.sourceLine ? Math.max(0, 12 - Math.min(entry.sourceLine, 12)) : 0;

  return categoryWeight + entry.references * 6 + nameComplexityWeight + sourceLineWeight;
}
