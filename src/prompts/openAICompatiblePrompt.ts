import {
  ExplanationRequest,
  FollowUpRequest
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
      '{"title":"string","summary":"string","sections":[{"label":"string","content":"string"}],"suggestedQuestions":["string"],"glossaryHints":[{"term":"string","meaning":"string","category":"variable"}],"note":"string"}',
      "Keep each sentence short and useful.",
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

  return {
    system: [
      "You explain a single code token in concise Chinese.",
      "Return valid JSON only.",
      "Use this shape:",
      '{"title":"string","summary":"string","sections":[{"label":"string","content":"string"}],"suggestedQuestions":["string"],"glossaryHints":[{"term":"string","meaning":"string","category":"variable"}],"note":"string"}',
      "Focus on the token's exact role at this callsite.",
      "Avoid generic placeholder wording.",
      request.customInstructions
    ].join(" "),
    user: [
      `Language: ${request.languageId}`,
      `Token: ${request.selectedText}`,
      `Goal: ${request.userGoal || "Explain the exact meaning of this token."}`,
      "",
      "Callsite before:",
      request.contextBefore || "(none)",
      "",
      "Callsite after:",
      request.contextAfter || "(none)",
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
      "Answer directly.",
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
