import {
  ExplanationSectionName,
  Occupation,
  ProfessionalLevel,
  PromptProfileRequest,
  ReasoningEffort
} from "../contracts";

export interface GlobalPromptProfileInput {
  occupation: Occupation;
  professionalLevel: ProfessionalLevel;
  userGoal: string;
  detailLevel: "fast" | "balanced" | "deep";
  sections?: ExplanationSectionName[];
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
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
    input.sections?.length
      ? `Prefer these sections when relevant: ${input.sections.join(", ")}.`
      : "Prefer compact sections only when they add useful signal.",
    input.reasoningEffort ? `Assume reasoning effort is ${input.reasoningEffort}.` : "",
    Number.isFinite(input.temperature) ? `Sampling temperature is ${input.temperature}.` : "",
    Number.isFinite(input.topP) ? `Top-p is ${input.topP}.` : "",
    Number.isFinite(input.maxTokens) ? `Target output budget is about ${input.maxTokens} tokens.` : "",
    input.userGoal
      ? `The user's current goal is: ${input.userGoal.trim()}.`
      : "The default goal is to help the user understand the code quickly and accurately.",
    "When the selected content is a user-defined symbol, explain its role in the current file before giving broader detail.",
    "Present explanations in a dictionary-like style.",
    "Prefer 2 to 4 short bullet points per section instead of long paragraphs.",
    "Avoid generic placeholder wording."
  ].join(" ");
}

export function buildPromptProfileGenerationPrompts(
  input: PromptProfileRequest
): { system: string; user: string } {
  return {
    system: [
      "You write reusable instruction prompts for another model that explains source code in Chinese.",
      "Return plain text only.",
      "Do not use markdown fences, headings, or commentary.",
      "The downstream system already enforces JSON response shape, so do not mention JSON keys or formatting contracts.",
      "Focus on audience tuning, terminology level, concision, and presentation style.",
      "Make the prompt strongly prefer dictionary-style explanations with short bullet points instead of long paragraphs.",
      "When selected content is a token or symbol, the prompt must prefer exact callsite meaning over generic definitions."
    ].join(" "),
    user: [
      "Write one compact reusable prompt in English.",
      `Occupation: ${input.occupation}`,
      `Professional level: ${input.professionalLevel}`,
      `Detail level: ${input.detailLevel}`,
      `Preferred sections: ${input.sections.join(", ") || "(none)"}`,
      `Reasoning effort: ${input.reasoningEffort}`,
      `Temperature: ${input.temperature}`,
      `Top P: ${input.topP}`,
      `Max tokens: ${input.maxTokens}`,
      `User goal: ${input.userGoal || "Help the user read source code quickly."}`,
      "Constraints:",
      "- Keep it under 140 words.",
      "- Mention dictionary-style output and short bullet points.",
      "- Mention exact callsite grounding for tokens and APIs.",
      "- Mention that user-defined symbols should be explained by current-file role first.",
      "- Do not mention JSON or schema enforcement."
    ].join("\n")
  };
}
