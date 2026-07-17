import {
  ExplanationRequest,
  ExplanationResponse,
  FollowUpRequest,
  FollowUpResponse,
  PreprocessCandidateSelectionRequest,
  PreprocessCandidateSelectionResponse,
  PromptProfileRequest,
  PromptProfileResponse,
  SymbolPreprocessRequest,
  SymbolPreprocessResponse
} from "../contracts";
import {
  selectPreprocessCandidatesFromPool
} from "../analysis/preprocess";
import { ExtensionLogger } from "../logging/logger";
import { generateGlobalPrompt } from "../prompts/globalPromptProfile";
import {
  buildLocalSummary,
  buildSectionContent,
  createSuggestedQuestions
} from "../analysis/summary";
import { ExplanationProvider } from "./providerTypes";
import { humanizeIdentifier, shortenText } from "../utils/text";

export class LocalExplanationProvider implements ExplanationProvider {
  readonly id = "local";

  constructor(private readonly logger?: ExtensionLogger) {}

  async explain(request: ExplanationRequest): Promise<ExplanationResponse> {
    const startedAt = Date.now();
    const summary = buildSelectionAwareLocalSummary(request) ?? buildLocalSummary(request);
    const sections: ExplanationResponse["sections"] = request.sections.map((sectionName) => {
      const content =
        buildSelectionAwareSection(request, sectionName) ??
        buildSectionContent(request, sectionName);

      return {
        label: sectionName,
        content,
        items: toBulletItems(content)
      };
    });
    const documentationItems = buildDocumentationItems(request);

    if (documentationItems.length > 0) {
      sections.unshift({
        label: "文档依据",
        content: documentationItems.join("；"),
        items: documentationItems
      });
    }

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

    answerParts.push("4. 当前回答来自本地兜底分析，不是远端模型推理结果。");

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
        summary: buildLocalPreprocessSummary(candidate),
        generatedAt: new Date().toISOString(),
        isPlaceholder: false
      })),
      source: this.id,
      latencyMs: Date.now() - startedAt
    };
  }

  async selectPreprocessCandidates(
    request: PreprocessCandidateSelectionRequest
  ): Promise<PreprocessCandidateSelectionResponse> {
    const startedAt = Date.now();
    const selectedCandidates = selectPreprocessCandidatesFromPool(
      request.candidatePool,
      request.professionalLevel,
      request.occupation
    );

    return {
      requestId: request.requestId,
      languageId: request.languageId,
      selectedTerms: selectedCandidates.map((candidate) => candidate.term),
      source: this.id,
      latencyMs: Date.now() - startedAt,
      note: "Used the local fallback selector because no remote model provider is configured."
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

function buildTitle(request: ExplanationRequest): string {
  const insight = request.selectionInsight;

  if (insight?.kind === "function") {
    return `函数：${insight.term}`;
  }

  if (insight?.kind === "variable" || insight?.kind === "constant") {
    return `变量：${insight.term}`;
  }

  if (insight?.origin === "library") {
    return `库符号：${insight.qualifiedName ?? insight.term}`;
  }

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

function buildSelectionAwareLocalSummary(request: ExplanationRequest): string | undefined {
  const insight = request.selectionInsight;

  if (!insight) {
    return undefined;
  }

  const sourceLabel =
    insight.origin === "library"
      ? `来自库 \`${insight.qualifiedName ?? insight.term}\``
      : insight.origin === "builtin"
        ? "属于语言内置符号"
        : "定义或使用于当前项目";

  if (request.granularity === "function" || insight.kind === "function") {
    const signature = insight.signature ? `签名为 \`${insight.signature}\`` : "签名需要结合定义确认";
    return `\`${insight.term}\` 是可调用函数，${sourceLabel}；${signature}。重点关注输入、返回值和副作用。`;
  }

  if (insight.kind === "variable" || insight.kind === "constant") {
    return `\`${insight.term}\` 是承载数据的${insight.kind === "constant" ? "常量" : "变量"}，${sourceLabel}。阅读时应先追踪它的赋值来源、当前含义和后续使用位置。`;
  }

  if (insight.kind === "class" || insight.kind === "type") {
    return `\`${insight.term}\` 是${insight.kind === "class" ? "类" : "类型"}，${sourceLabel}；当前解释重点是它约束或建模的数据结构。`;
  }

  return undefined;
}

function buildSelectionAwareSection(
  request: ExplanationRequest,
  sectionName: string
): string | undefined {
  const insight = request.selectionInsight;

  if (!insight) {
    return undefined;
  }

  if (request.granularity === "function" || insight.kind === "function") {
    if (sectionName === "inputOutput") {
      return insight.signature
        ? `调用签名：${insight.signature}。返回值和异常行为以当前实现及文档依据为准。`
        : "先确认参数如何进入函数、返回值被谁使用，以及是否修改外部状态。";
    }

    if (sectionName === "usage") {
      return "把它看作一段可复用流程：当前调用点提供输入，函数内部完成转换或副作用，再把结果交给下游。";
    }

    if (sectionName === "risk") {
      return "优先检查异常、可变参数、外部 I/O、共享状态修改和返回值未处理等风险。";
    }
  }

  if (insight.kind === "variable" || insight.kind === "constant") {
    if (sectionName === "inputOutput") {
      return "这里的“输入”是变量的赋值来源，“输出”是它参与的计算、条件判断或函数调用。";
    }

    if (sectionName === "usage") {
      return "沿着赋值点和引用点阅读，确认该值在当前作用域中的语义是否发生变化。";
    }

    if (sectionName === "risk") {
      return "重点检查未初始化、空值、类型或张量形状变化、单位混淆，以及被意外修改。";
    }
  }

  return undefined;
}

function buildDocumentationItems(request: ExplanationRequest): string[] {
  const insight = request.selectionInsight;

  if (!insight || (insight.origin !== "library" && insight.origin !== "builtin")) {
    return [];
  }

  return [
    insight.signature ? `签名：${insight.signature}` : undefined,
    insight.documentationSource === "language-service" && insight.documentation
      ? `文档：${shortenText(insight.documentation, 280)}`
      : undefined
  ].filter((item): item is string => Boolean(item));
}

function buildLocalPreprocessSummary(
  candidate: SymbolPreprocessRequest["candidates"][number]
): string {
  const concept = humanizeIdentifier(candidate.term) || candidate.term;

  switch (candidate.category) {
    case "function":
      return `\`${candidate.term}\` 是当前文件中的函数，负责 ${concept} 相关流程；重点查看其参数、返回值和第 ${candidate.sourceLine} 行附近的副作用。`;
    case "class":
      return `\`${candidate.term}\` 是类，用于组织 ${concept} 相关状态和行为。`;
    case "type":
      return `\`${candidate.term}\` 是类型，用于约束 ${concept} 相关数据结构。`;
    case "label":
      return `\`${candidate.term}\` 是当前文件使用的标签或类别值。`;
    default:
      return `\`${candidate.term}\` 是当前文件中的变量，表示 ${concept} 相关数据；应结合第 ${candidate.sourceLine} 行的赋值来源和引用位置理解。`;
  }
}
