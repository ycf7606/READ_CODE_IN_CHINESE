import {
  ExplanationRequest,
  ExplanationResponse,
  FollowUpRequest,
  FollowUpResponse
} from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import {
  buildLocalSummary,
  buildSectionContent,
  createSuggestedQuestions
} from "../analysis/summary";
import { ExplanationProvider } from "./providerTypes";

export class LocalExplanationProvider implements ExplanationProvider {
  readonly id = "local";

  constructor(private readonly logger?: ExtensionLogger) {}

  async explain(request: ExplanationRequest): Promise<ExplanationResponse> {
    const startedAt = Date.now();
    const summary = buildLocalSummary(request);
    const sections = request.sections.map((sectionName) => ({
      label: sectionName,
      content: buildSectionContent(request, sectionName)
    }));

    this.logger?.info("Local provider generated explanation", {
      requestId: request.requestId,
      granularity: request.granularity,
      knowledgeSnippets: request.knowledgeSnippets.length
    });

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
      request.question.toLowerCase().includes(section.label.toLowerCase())
    );
    const glossaryHints = request.explanation.glossaryHints
      .slice(0, 3)
      .map((entry) => `${entry.term}: ${entry.meaning}`)
      .join("；");
    const answerParts = [
      `围绕这段代码，当前能确定的核心点是：${request.explanation.summary}`
    ];

    if (relatedSection) {
      answerParts.push(`如果继续看 ${relatedSection.label}，重点是：${relatedSection.content}`);
    }

    if (glossaryHints) {
      answerParts.push(`相关术语可以先这样理解：${glossaryHints}`);
    }

    answerParts.push(
      "当前回答来自本地兜底分析，不是远端模型推理；如果要更细的语义解释，需要先让远端 provider 生效。"
    );

    this.logger?.info("Local provider answered follow-up", {
      questionLength: request.question.length,
      requestId: request.request.requestId
    });

    return {
      answer: answerParts.join(" "),
      suggestedQuestions: [
        "这段代码依赖了哪些上游变量或函数？",
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
