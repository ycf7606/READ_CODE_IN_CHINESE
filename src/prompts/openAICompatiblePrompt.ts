import {
  ExplanationRequest,
  PreprocessCandidateSelectionRequest,
  FollowUpRequest,
  SymbolPreprocessRequest
} from "../contracts";

export function buildExplainPrompts(request: ExplanationRequest): {
  system: string;
  user: string;
} {
  if (request.granularity === "token") {
    return buildTokenExplainPrompts(request);
  }

  const glossaryContext = request.glossaryEntries
    .slice(0, 12)
    .map((entry) => `- ${entry.term}: ${entry.meaning}`)
    .join("\n");
  const knowledgeContext = request.knowledgeSnippets
    .map(
      (snippet) =>
        `- ${snippet.title} (score=${snippet.score}): ${snippet.excerpt}`
    )
    .join("\n");

  return {
    system: [
      "You explain source code in concise Chinese.",
      "Respond with valid JSON only.",
      "Use this exact shape:",
      '{"title":"string","summary":"string","sections":[{"label":"string","items":["string"],"content":"string"}],"suggestedQuestions":["string"],"glossaryHints":[{"term":"string","meaning":"string","category":"variable"}],"note":"string"}',
      "Use dictionary-style Chinese.",
      "Keep the summary to one or two short sentences.",
      "For each section, prefer 2 to 4 short bullet items in `items` instead of a long paragraph.",
      "If you still include `content`, keep it short and consistent with the bullet items.",
      "Do not include markdown fences.",
      "Ground the answer in the selected code and nearby context.",
      buildAudienceGuidance(request),
      request.customInstructions
    ].join(" "),
    user: [
      `Goal: ${request.userGoal || "Help the user read source code quickly."}`,
      `Language: ${request.languageId}`,
      `Granularity: ${request.granularity}`,
      `Detail level: ${request.detailLevel}`,
      `Occupation: ${request.occupation}`,
      `Professional level: ${request.professionalLevel}`,
      `Requested sections: ${request.sections.join(", ")}`,
      "",
      "Context before:",
      request.contextBefore || "(none)",
      "",
      "Selected code:",
      request.selectedText,
      "",
      "Context after:",
      request.contextAfter || "(none)",
      "",
      "Glossary hints:",
      glossaryContext || "(none)",
      "",
      "Knowledge snippets:",
      knowledgeContext || "(none)"
    ].join("\n")
  };
}

function buildTokenExplainPrompts(request: ExplanationRequest): {
  system: string;
  user: string;
} {
  const knowledgeContext = request.knowledgeSnippets
    .map((snippet) => `- ${snippet.title}: ${snippet.excerpt}`)
    .join("\n");
  const glossaryContext = request.glossaryEntries
    .slice(0, 8)
    .map((entry) => `- ${entry.term}: ${entry.meaning}`)
    .join("\n");

  return {
    system: [
      "You explain a single code token in concise Chinese.",
      "Return valid JSON only.",
      "Use this shape:",
      '{"title":"string","summary":"string","sections":[{"label":"string","items":["string"],"content":"string"}],"suggestedQuestions":["string"],"glossaryHints":[{"term":"string","meaning":"string","category":"variable"}],"note":"string"}',
      "Focus on the token's exact role at this callsite and in the current line.",
      "If the token is a library, framework, or API symbol, explain that concrete API usage here instead of giving a generic placeholder summary.",
      "If the meaning is still ambiguous, say exactly what context is missing.",
      "Prefer short dictionary-style bullet items instead of long prose.",
      "Avoid generic placeholder wording.",
      buildAudienceGuidance(request),
      request.customInstructions
    ].join(" "),
    user: [
      `Language: ${request.languageId}`,
      `Token: ${request.selectedText}`,
      `Occupation: ${request.occupation}`,
      `Professional level: ${request.professionalLevel}`,
      `Goal: ${request.userGoal || "Explain the exact meaning of this token."}`,
      "",
      "Selection line preview:",
      request.selectionPreview || "(none)",
      "",
      "Callsite before:",
      request.contextBefore || "(none)",
      "",
      "Callsite after:",
      request.contextAfter || "(none)",
      "",
      "Glossary hints:",
      glossaryContext || "(none)",
      "",
      "Knowledge snippets:",
      knowledgeContext || "(none)"
    ].join("\n")
  };
}

export function buildFollowUpPrompts(request: FollowUpRequest): {
  system: string;
  user: string;
} {
  const historyText = request.chatHistory
    .slice(-6)
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join("\n");

  return {
    system: [
      "You continue a code-reading conversation in concise Chinese.",
      "Answer directly with 2 to 4 short bullet points when possible.",
      "Keep the explanation grounded in the prior explanation and user question.",
      buildAudienceGuidance(request.request),
      request.request.customInstructions || ""
    ].join(" "),
    user: [
      `Current explanation title: ${request.explanation.title}`,
      `Summary: ${request.explanation.summary}`,
      `Occupation: ${request.request.occupation}`,
      `Professional level: ${request.request.professionalLevel}`,
      "Recent chat history:",
      historyText || "(none)",
      "",
      "Selected code:",
      request.request.selectedText,
      "",
      `User question: ${request.question}`
    ].join("\n")
  };
}

function buildAudienceGuidance(request: ExplanationRequest): string {
  const occupationGuidance =
    request.occupation === "student"
      ? "Prefer teaching-style wording and define symbols before abstract relations."
      : request.occupation === "developer"
        ? "Prioritize implementation intent, data flow, and maintenance-relevant meaning."
        : request.occupation === "data-scientist"
          ? "Prioritize tensor, feature, shape, pipeline, and modeling meaning when relevant."
          : request.occupation === "researcher"
            ? "Prioritize assumptions, algorithmic role, and experimental context when relevant."
            : "Prioritize module boundaries, operational impact, and hidden coupling when relevant.";
  const levelGuidance =
    request.professionalLevel === "beginner"
      ? "Assume less prior context and explain symbols more directly."
      : request.professionalLevel === "intermediate"
        ? "Assume medium familiarity, skip trivial syntax, and keep the answer compact."
        : "Assume strong prior knowledge, skip obvious framework conventions, and stay terse.";

  return `${occupationGuidance} ${levelGuidance}`;
}

export function buildSymbolPreprocessPrompts(request: SymbolPreprocessRequest): {
  system: string;
  user: string;
} {
  const candidateLines = request.candidates
    .map(
      (candidate) =>
        `- ${candidate.term} | category=${candidate.category} | line=${candidate.sourceLine} | refs=${candidate.references}`
    )
    .join("\n");

  return {
    system: [
      "You summarize file-local code symbols in concise Chinese.",
      "Respond with valid JSON only.",
      'Use this exact shape: {"entries":[{"term":"string","summary":"string"}]}',
      "Return one short sentence per symbol.",
      "This is a file wordbook task, not a full explanation task.",
      "Focus only on the symbol's role in this file.",
      "Do not mirror explanation sections such as summary, inputOutput, usage, syntax, or risk.",
      "Do not add sections, markdown, or extra keys.",
      "Do not explain imports, built-in syntax, or generic language rules.",
      request.customInstructions || ""
    ].join(" "),
    user: [
      `Language: ${request.languageId}`,
      `Occupation: ${request.occupation}`,
      `Professional level: ${request.professionalLevel}`,
      `Goal: ${request.userGoal || "Prepare quick symbol explanations for this file."}`,
      "",
      "Candidate symbols:",
      candidateLines || "(none)",
      "",
      "Full file context:",
      request.sourceCode
    ].join("\n")
  };
}

export function buildPreprocessCandidateSelectionPrompts(
  request: PreprocessCandidateSelectionRequest
): {
  system: string;
  user: string;
} {
  const candidateLines = request.candidatePool
    .map(
      (candidate) =>
        `- ${candidate.term} | category=${candidate.category} | line=${candidate.sourceLine} | refs=${candidate.references} | score=${candidate.score}`
    )
    .join("\n");

  return {
    system: [
      "You choose which file-local code symbols should enter a Chinese code-reading wordbook.",
      "Respond with valid JSON only.",
      'Use this exact shape: {"selectedTerms":["string"]}',
      "Select only terms that are worth preprocessing for this audience.",
      "Do not over-prune the candidate list.",
      "Beginner users should keep the full candidate list unless a candidate is clearly invalid for a wordbook.",
      "Intermediate users are the default medium audience and should keep about 85% of the candidates, removing only the most basic or redundant items.",
      "Expert users should still keep about 70% of the candidates, removing only the most obvious items.",
      "Only select terms that already exist in the candidate list.",
      "Do not explain the terms here.",
      "Do not add markdown or extra keys.",
      request.customInstructions || ""
    ].join(" "),
    user: [
      `Language: ${request.languageId}`,
      `Occupation: ${request.occupation}`,
      `Professional level: ${request.professionalLevel}`,
      `Target selection count: ${request.targetSelectionCount} / ${request.candidatePool.length}`,
      `Retention ratio: ${Math.round(request.retentionRatio * 100)}%`,
      `Goal: ${request.userGoal || "Choose which symbols deserve a file-local wordbook entry."}`,
      "",
      "Candidate pool:",
      candidateLines || "(none)",
      "",
      "Full file context:",
      request.sourceCode
    ].join("\n")
  };
}
