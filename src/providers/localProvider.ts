import {
  ExplanationRequest,
  ExplanationResponse,
  FollowUpRequest,
  FollowUpResponse,
  PromptProfileRequest,
  PromptProfileResponse,
  SymbolPreprocessRequest,
  SymbolPreprocessResponse
} from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { generateGlobalPrompt } from "../prompts/globalPromptProfile";
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
    const sections = request.sections.map((sectionName) => {
      const content = buildSectionContent(request, sectionName);

      return {
        label: sectionName,
        content,
        items: toBulletItems(content)
      };
    });

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

  async generatePromptProfile(request: PromptProfileRequest): Promise<PromptProfileResponse> {
    const startedAt = Date.now();

    return {
      prompt: generateGlobalPrompt(request),
      source: this.id,
      latencyMs: Date.now() - startedAt,
      note: "Used the local fallback prompt generator because no remote model provider is configured."
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
      `1. 当前最稳妥的结论是：${request.explanation.summary}`
    ];

    if (relatedSection) {
      answerParts.push(
        `2. 如果继续看 ${relatedSection.label}，重点是：${
          relatedSection.items?.[0] ?? relatedSection.content
        }`
      );
    }

    if (glossaryHints) {
      answerParts.push(`3. 相关术语可以先这样理解：${glossaryHints}`);
    }

    answerParts.push("4. 当前回答来自本地兜底分析，不是远端模型推理。");

    this.logger?.info("Local provider answered follow-up", {
      questionLength: request.question.length,
      requestId: request.request.requestId
    });

    return {
      answer: answerParts.join("\n"),
      suggestedQuestions: [
        "这一段依赖了哪些上游变量或函数？",
        "如果我要修改这里，最容易出错的点是什么？"
      ],
      source: this.id,
      latencyMs: Date.now() - startedAt
    };
  }

  async preprocessSymbols(
    request: SymbolPreprocessRequest
  ): Promise<SymbolPreprocessResponse> {
    const startedAt = Date.now();

    return {
      requestId: request.requestId,
      languageId: request.languageId,
      entries: request.candidates.map((candidate) => ({
        term: candidate.term,
        normalizedTerm: candidate.normalizedTerm,
        category: candidate.category,
        sourceLine: candidate.sourceLine,
        summary: `\`${candidate.term}\` 是当前文件中的${localCategoryLabel(
          candidate.category
        )}，具体职责要结合附近赋值和调用位置判断。`,
        generatedAt: new Date().toISOString()
      })),
      source: this.id,
      latencyMs: Date.now() - startedAt
    };
  }
}

function toBulletItems(content: string): string[] {
  return Array.from(
    new Set(
      content
        .split(/\n+|(?<=[。！？；;])\s*/u)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  ).slice(0, 4);
}

function localCategoryLabel(category: SymbolPreprocessRequest["candidates"][number]["category"]): string {
  switch (category) {
    case "function":
      return "函数";
    case "class":
      return "类";
    case "type":
      return "类型";
    default:
      return "变量";
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
