import {
  ExplanationRequest,
  ExplanationResponse,
  FollowUpRequest,
  FollowUpResponse
} from "../contracts";
import {
  buildLocalSummary,
  buildSectionContent,
  createSuggestedQuestions
} from "../analysis/summary";
import { ExplanationProvider } from "./providerTypes";

export class LocalExplanationProvider implements ExplanationProvider {
  readonly id = "local";

  async explain(request: ExplanationRequest): Promise<ExplanationResponse> {
    const startedAt = Date.now();
    const summary = buildLocalSummary(request);
    const sections = request.sections.map((sectionName) => ({
      label: sectionName,
      content: buildSectionContent(request, sectionName)
    }));

    return {
      requestId: request.requestId,
      title: buildTitle(request),
      summary,
      sections,
      suggestedQuestions: createSuggestedQuestions(request, request.glossaryEntries),
      glossaryHints: request.glossaryEntries.slice(0, 8),
      granularity: request.granularity,
      selectionText: request.selectedText,
      source: this.id,
      latencyMs: Date.now() - startedAt,
      knowledgeUsed: request.knowledgeSnippets.map((entry) => entry.title),
      note:
        request.knowledgeSnippets.length > 0
          ? "Used imported knowledge snippets to improve the explanation context."
          : "Used the local heuristic engine because no remote model provider is configured."
    };
  }

  async answerFollowUp(request: FollowUpRequest): Promise<FollowUpResponse> {
    const startedAt = Date.now();
    const relatedSection = request.explanation.sections.find((section) =>
      request.question.includes(section.label)
    );
    const glossaryHints = request.explanation.glossaryHints
      .slice(0, 3)
      .map((entry) => `${entry.term}: ${entry.meaning}`)
      .join(" ");

    const answerParts = [
      `围绕这段代码，核心仍然是：${request.explanation.summary}`
    ];

    if (relatedSection) {
      answerParts.push(`补充到 ${relatedSection.label} 这一点：${relatedSection.content}`);
    }

    if (glossaryHints) {
      answerParts.push(`相关术语可以优先按这些含义理解：${glossaryHints}`);
    }

    answerParts.push("如果你要继续追问，优先问输入输出、调用时机、或者副作用。");

    return {
      answer: answerParts.join(" "),
      suggestedQuestions: [
        "这段逻辑依赖哪些上游变量？",
        "如果我要改这里，最容易出错的点是什么？"
      ],
      source: this.id,
      latencyMs: Date.now() - startedAt
    };
  }
}

function buildTitle(request: ExplanationRequest): string {
  switch (request.granularity) {
    case "token":
      return "Variable / Symbol Explanation";
    case "function":
      return "Function Explanation";
    case "block":
      return "Block Explanation";
    case "file":
      return "File Overview";
    case "workspace":
      return "Workspace Overview";
    default:
      return "Statement Explanation";
  }
}
