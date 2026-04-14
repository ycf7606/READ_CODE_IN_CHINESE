import { Occupation, ProfessionalLevel } from "../contracts";

export interface GlobalPromptProfileInput {
  occupation: Occupation;
  professionalLevel: ProfessionalLevel;
  userGoal: string;
  detailLevel: "fast" | "balanced" | "deep";
}

const OCCUPATION_DESCRIPTION: Record<Occupation, string> = {
  student: "Prefer teaching-style explanations with direct definitions before deeper relations.",
  developer: "Prioritize implementation intent, data flow, and likely maintenance concerns.",
  "data-scientist": "Emphasize tensor, data-shape, feature, and pipeline meaning when relevant.",
  researcher: "Emphasize assumptions, algorithmic role, and experimental context when relevant.",
  maintainer: "Prioritize module boundaries, change impact, and hidden coupling."
};

const PROFESSIONAL_DESCRIPTION: Record<ProfessionalLevel, string> = {
  beginner: "Assume limited prior context and define symbols before abstract reasoning.",
  intermediate: "Balance direct explanation with concise technical terms.",
  expert: "Be concise and avoid explaining trivial syntax unless it matters."
};

const DETAIL_DESCRIPTION: Record<GlobalPromptProfileInput["detailLevel"], string> = {
  fast: "Prefer short answers and only expand when ambiguity is high.",
  balanced: "Give a compact but sufficiently grounded explanation.",
  deep: "Include more contextual reasoning when it materially improves correctness."
};

export function generateGlobalPrompt(input: GlobalPromptProfileInput): string {
  return [
    "Explain source code in concise Chinese.",
    OCCUPATION_DESCRIPTION[input.occupation],
    PROFESSIONAL_DESCRIPTION[input.professionalLevel],
    DETAIL_DESCRIPTION[input.detailLevel],
    input.userGoal
      ? `The user's current goal is: ${input.userGoal.trim()}.`
      : "The default goal is to help the user understand the code quickly and accurately.",
    "When the selected content is a user-defined symbol, explain its role in the current file before giving broader detail.",
    "Avoid generic placeholder wording."
  ].join(" ");
}
