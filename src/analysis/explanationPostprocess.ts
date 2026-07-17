import { ExplanationRequest, ExplanationResponse } from "../contracts";
import { shortenText } from "../utils/text";

export function attachSelectionDocumentation(
  response: ExplanationResponse,
  request: ExplanationRequest
): ExplanationResponse {
  const insight = request.selectionInsight;
  const languageServiceDocumentation =
    insight?.documentationSource === "language-service" ? insight.documentation : undefined;

  if (
    !insight ||
    (insight.origin !== "library" && insight.origin !== "builtin") ||
    (!insight.signature && !languageServiceDocumentation)
  ) {
    return response;
  }

  const alreadyHasDocumentation = response.sections.some((section) =>
    /文档|documentation|api reference/i.test(section.label)
  );

  if (alreadyHasDocumentation) {
    return response;
  }

  const items = [
    insight.signature ? `签名：${insight.signature}` : undefined,
    languageServiceDocumentation
      ? `文档摘要：${shortenText(languageServiceDocumentation, 280)}`
      : undefined
  ].filter((item): item is string => Boolean(item));

  return {
    ...response,
    sections: [
      {
        label: "文档依据",
        content: items.join("；"),
        items
      },
      ...response.sections
    ]
  };
}
