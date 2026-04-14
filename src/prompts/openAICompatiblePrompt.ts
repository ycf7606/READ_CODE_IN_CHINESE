import {
  ExplanationRequest,
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
      request.customInstructions
    ].join(" "),
    user: [
      `Goal: ${request.userGoal || "Help the user read source code quickly."}`,
      `Language: ${request.languageId}`,
      `Granularity: ${request.granularity}`,
      `Detail level: ${request.detailLevel}`,
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
      request.customInstructions
    ].join(" "),
    user: [
      `Language: ${request.languageId}`,
      `Token: ${request.selectedText}`,
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
      request.request.customInstructions || ""
    ].join(" "),
    user: [
      `Current explanation title: ${request.explanation.title}`,
      `Summary: ${request.explanation.summary}`,
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
      "You summarize user-defined code symbols in concise Chinese.",
      "Respond with valid JSON only.",
      'Use this exact shape: {"entries":[{"term":"string","summary":"string"}]}',
      "Return one short sentence per symbol.",
      "Focus only on the symbol's role in this file.",
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
