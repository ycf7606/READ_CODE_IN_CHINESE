import {
  ChatTurn,
  ExplanationRequest,
  ExplanationResponse,
  ExplanationSection,
  ExtensionSettings,
  FollowUpRequest,
  FollowUpResponse,
  GlossaryEntry,
  PreprocessCandidateSelectionRequest,
  PreprocessCandidateSelectionResponse,
  PromptProfileRequest,
  PromptProfileResponse,
  PreprocessedSymbolCandidate,
  PreprocessedSymbolEntry,
  SymbolPreprocessRequest,
  SymbolPreprocessResponse
} from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { buildPromptProfileGenerationPrompts } from "../prompts/globalPromptProfile";
import {
  buildExplainPrompts,
  buildFollowUpPrompts,
  buildPreprocessCandidateSelectionPrompts,
  buildSymbolPreprocessPrompts
} from "../prompts/openAICompatiblePrompt";
import { ExplanationProvider, ProviderCallOptions } from "./providerTypes";

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionChoice {
  text?: string;
  message?: {
    content?:
      | string
      | Array<{
          type?: string;
          text?: string;
          value?: string;
        }>
      | {
          text?: string;
          value?: string;
        };
    reasoning_content?: string | null;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

interface RemoteEndpointConfig {
  baseUrl: string;
  apiKeyEnvVar: string;
  apiKey: string;
  model: string;
}

export class OpenAICompatibleProvider implements ExplanationProvider {
  readonly id = "openai-compatible";

  constructor(
    private readonly settings: ExtensionSettings,
    private readonly logger?: ExtensionLogger
  ) {}

  async explain(
    request: ExplanationRequest,
    options?: ProviderCallOptions
  ): Promise<ExplanationResponse> {
    const startedAt = Date.now();
    const prompts = buildExplainPrompts(request);
    const content = await this.createChatCompletion(
      [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ],
      "explain",
      options?.signal
    );
    const parsedResponse = parseJsonResponse(content);

    this.logger?.info("Remote provider generated explanation", {
      requestId: request.requestId,
      model: this.settings.providerModel,
      granularity: request.granularity
    });

    return {
      requestId: request.requestId,
      title: readStringValue(parsedResponse.title, "Code Explanation"),
      summary: readStringValue(
        parsedResponse.summary,
        "No summary was returned by the provider."
      ),
      sections: normalizeSections(parsedResponse.sections),
      suggestedQuestions: normalizeStringArray(parsedResponse.suggestedQuestions),
      glossaryHints: normalizeGlossaryHints(parsedResponse.glossaryHints),
      granularity: request.granularity,
      selectionText: request.selectedText,
      source: this.id,
      latencyMs: Date.now() - startedAt,
      note: typeof parsedResponse.note === "string" ? parsedResponse.note : undefined,
      knowledgeUsed: request.knowledgeSnippets.map((entry) => entry.title)
    };
  }

  async generatePromptProfile(
    request: PromptProfileRequest,
    options?: ProviderCallOptions
  ): Promise<PromptProfileResponse> {
    const startedAt = Date.now();
    const prompts = buildPromptProfileGenerationPrompts(request);
    const content = await this.createChatCompletion(
      [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ],
      "prompt-profile",
      options?.signal
    );

    return {
      prompt: content.trim(),
      source: this.id,
      latencyMs: Date.now() - startedAt
    };
  }

  async answerFollowUp(
    request: FollowUpRequest,
    options?: ProviderCallOptions
  ): Promise<FollowUpResponse> {
    const startedAt = Date.now();
    const prompts = buildFollowUpPrompts(request);
    const historyMessages = request.chatHistory
      .slice(-4)
      .map<ChatCompletionMessage>((entry: ChatTurn) => ({
        role: entry.role === "assistant" ? "assistant" : "user",
        content: entry.content
      }));
    const content = await this.createChatCompletion(
      [
        { role: "system", content: prompts.system },
        ...historyMessages,
        { role: "user", content: prompts.user }
      ],
      "follow-up",
      options?.signal
    );

    this.logger?.info("Remote provider answered follow-up", {
      requestId: request.request.requestId,
      model: this.settings.providerModel
    });

    return {
      answer: content.trim(),
      suggestedQuestions: [
        "它和上游调用链之间是什么关系？",
        "这里有没有隐藏的副作用或状态变化？"
      ],
      source: this.id,
      latencyMs: Date.now() - startedAt
    };
  }

  async preprocessSymbols(
    request: SymbolPreprocessRequest,
    options?: ProviderCallOptions
  ): Promise<SymbolPreprocessResponse> {
    const startedAt = Date.now();
    const prompts = buildSymbolPreprocessPrompts(request);
    const content = await this.createChatCompletion(
      [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ],
      "preprocess",
      options?.signal
    );
    const parsedResponse = parseJsonResponse(content);

    return {
      requestId: request.requestId,
      languageId: request.languageId,
      entries: normalizePreprocessEntries(parsedResponse.entries, request.candidates),
      source: this.id,
      latencyMs: Date.now() - startedAt
    };
  }

  async selectPreprocessCandidates(
    request: PreprocessCandidateSelectionRequest,
    options?: ProviderCallOptions
  ): Promise<PreprocessCandidateSelectionResponse> {
    const startedAt = Date.now();
    const prompts = buildPreprocessCandidateSelectionPrompts(request);
    const content = await this.createChatCompletion(
      [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ],
      "preprocess-select",
      options?.signal
    );
    const parsedResponse = parseJsonResponse(content);

    if (!("selectedTerms" in parsedResponse) && !("terms" in parsedResponse)) {
      throw new Error("Remote provider did not return selectedTerms for preprocess selection.");
    }

    const selectedTerms = normalizeSelectedTerms(
      parsedResponse.selectedTerms ?? parsedResponse.terms,
      request.candidatePool
    );

    this.logger?.info("Remote provider selected preprocess candidates", {
      requestId: request.requestId,
      model: this.settings.providerModel,
      candidatePoolSize: request.candidatePool.length,
      selectedCount: selectedTerms.length
    });

    return {
      requestId: request.requestId,
      languageId: request.languageId,
      selectedTerms,
      source: this.id,
      latencyMs: Date.now() - startedAt,
      note: typeof parsedResponse.note === "string" ? parsedResponse.note : undefined
    };
  }

  private async createChatCompletion(
    messages: ChatCompletionMessage[],
    mode:
      | "explain"
      | "follow-up"
      | "preprocess"
      | "preprocess-select"
      | "prompt-profile",
    signal?: AbortSignal
  ): Promise<string> {
    const endpoints = getConfiguredRemoteEndpoints(this.settings);

    if (endpoints.length === 0) {
      throw new Error("No valid remote endpoints are configured for the OpenAI-compatible provider.");
    }

    try {
      let payloadCandidatesByEndpoint = new Map<string, Array<Record<string, unknown>>>();
      let logicalAttempt = 0;
      const attemptErrors: string[] = [];

      for (let round = 0; round < 2; round += 1) {
        for (const endpoint of endpoints) {
          const endpointKey = `${endpoint.baseUrl}|${endpoint.model}`;
          const payloadCandidates =
            payloadCandidatesByEndpoint.get(endpointKey) ??
            buildPayloadCandidates(this.settings, messages, mode, endpoint.model);

          payloadCandidatesByEndpoint.set(endpointKey, payloadCandidates);

          for (const payloadBody of payloadCandidates) {
            if (signal?.aborted) {
              throw new Error("Request aborted");
            }

            logicalAttempt += 1;
            this.logger?.info("Sending remote provider request", {
              mode,
              attempt: logicalAttempt,
              round: round + 1,
              endpointBaseUrl: endpoint.baseUrl,
              endpointModel: endpoint.model,
              endpointApiKeyEnvVar: endpoint.apiKeyEnvVar,
              endpointIndex: endpoints.indexOf(endpoint) + 1,
              endpointCount: endpoints.length,
              messageCount: messages.length,
              temperature: payloadBody.temperature,
              topP: payloadBody.top_p,
              maxTokens: payloadBody.max_tokens,
              reasoningEffort: payloadBody.reasoning_effort ?? "(omitted)",
              hasResponseFormat: Boolean(payloadBody.response_format)
            });

            try {
              const payload = await this.sendChatCompletionRequest(
                endpoint,
                payloadBody,
                signal
              );
              const content = extractMessageContent(payload.choices?.[0]);

              if (content) {
                return content;
              }

              this.logger?.warn("Remote provider returned a choice without message content", {
                mode,
                attempt: logicalAttempt,
                endpointBaseUrl: endpoint.baseUrl,
                endpointModel: endpoint.model,
                payloadPreview: JSON.stringify(payload).slice(0, 500)
              });
            } catch (error) {
              if (isAbortLikeError(error)) {
                throw error;
              }

              const errorMessage = error instanceof Error ? error.message : String(error);
              attemptErrors.push(
                `[${endpoint.baseUrl}] ${errorMessage}`
              );
              this.logger?.warn("Remote provider attempt failed, trying next endpoint if available", {
                mode,
                attempt: logicalAttempt,
                endpointBaseUrl: endpoint.baseUrl,
                endpointModel: endpoint.model,
                error: errorMessage
              });
            }
          }
        }
      }

      if (attemptErrors.length > 0) {
        throw new Error(
          `All configured remote endpoints failed. ${attemptErrors.slice(0, 4).join(" | ")}`
        );
      }

      throw new Error("Remote provider did not return a message content.");
    } catch (error) {
      this.logger?.error("Remote provider request failed", error);
      throw error;
    }
  }

  private async sendChatCompletionRequest(
    endpoint: RemoteEndpointConfig,
    payloadBody: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ChatCompletionResponse> {
    const controller = new AbortController();
    const abortHandler = () => controller.abort();

    signal?.addEventListener("abort", abortHandler);
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      this.settings.providerTimeoutMs
    );

    try {
      if (signal?.aborted) {
        throw new Error("Request aborted");
      }

      const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${endpoint.apiKey}`
        },
        body: JSON.stringify(payloadBody),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await safeReadText(response);
        throw new Error(
          `Remote provider returned ${response.status} ${response.statusText}. ${shortenWhitespace(errorText)}`
        );
      }

      return (await response.json()) as ChatCompletionResponse;
    } finally {
      clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", abortHandler);
    }
  }
}

function getConfiguredRemoteEndpoints(settings: ExtensionSettings): RemoteEndpointConfig[] {
  const rawEndpoints = [
    {
      baseUrl: settings.providerBaseUrl,
      apiKeyEnvVar: settings.providerApiKeyEnvVar,
      model: settings.providerModel
    },
    ...settings.providerFallbacks.map((endpoint) => ({
      baseUrl: endpoint.baseUrl,
      apiKeyEnvVar: endpoint.apiKeyEnvVar,
      model: endpoint.model ?? settings.providerModel
    }))
  ];
  const uniqueEndpoints = new Set<string>();
  const normalizedEndpoints: RemoteEndpointConfig[] = [];

  for (const endpoint of rawEndpoints) {
    const baseUrl = endpoint.baseUrl.trim().replace(/\/+$/, "");
    const apiKeyEnvVar = endpoint.apiKeyEnvVar.trim();
    const model = endpoint.model.trim();

    if (!baseUrl || !apiKeyEnvVar || !model) {
      continue;
    }

    const uniqueKey = `${baseUrl}|${apiKeyEnvVar}|${model}`;

    if (uniqueEndpoints.has(uniqueKey)) {
      continue;
    }

    const apiKey = process.env[apiKeyEnvVar]?.trim();

    if (!apiKey) {
      continue;
    }

    uniqueEndpoints.add(uniqueKey);
    normalizedEndpoints.push({
      baseUrl,
      apiKeyEnvVar,
      apiKey,
      model
    });
  }

  return normalizedEndpoints;
}

function isAbortLikeError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error) {
    return error.name === "AbortError" || /aborted/i.test(error.message);
  }

  return false;
}

function buildPayloadCandidates(
  settings: ExtensionSettings,
  messages: ChatCompletionMessage[],
  mode:
    | "explain"
    | "follow-up"
    | "preprocess"
    | "preprocess-select"
    | "prompt-profile",
  model: string
): Array<Record<string, unknown>> {
  const basePayload = {
    model,
    temperature: settings.providerTemperature,
    top_p: settings.providerTopP,
    max_tokens: settings.providerMaxTokens,
    messages
  };

  if (mode === "follow-up") {
    return [
      {
        ...basePayload,
        reasoning_effort: settings.providerReasoningEffort
      },
      basePayload
    ];
  }

  if (mode === "preprocess") {
    return [
      {
        ...basePayload,
        temperature: 0,
        max_tokens: Math.min(settings.providerMaxTokens, 700),
        reasoning_effort: "low",
        response_format: { type: "json_object" }
      },
      {
        ...basePayload,
        temperature: 0,
        max_tokens: Math.min(settings.providerMaxTokens, 700),
        response_format: { type: "json_object" }
      }
    ];
  }

  if (mode === "preprocess-select") {
    return [
      {
        ...basePayload,
        temperature: 0,
        max_tokens: Math.min(settings.providerMaxTokens, 400),
        reasoning_effort: "low",
        response_format: { type: "json_object" }
      },
      {
        ...basePayload,
        temperature: 0,
        max_tokens: Math.min(settings.providerMaxTokens, 400),
        response_format: { type: "json_object" }
      }
    ];
  }

  if (mode === "prompt-profile") {
    return [
      {
        ...basePayload,
        temperature: Math.max(0, Math.min(settings.providerTemperature, 0.6)),
        max_tokens: Math.min(settings.providerMaxTokens, 300),
        reasoning_effort: settings.providerReasoningEffort
      },
      {
        ...basePayload,
        temperature: 0.2,
        max_tokens: Math.min(settings.providerMaxTokens, 300)
      }
    ];
  }

  return [
    {
      ...basePayload,
      reasoning_effort: settings.providerReasoningEffort,
      response_format: { type: "json_object" }
    },
    {
      ...basePayload,
      response_format: { type: "json_object" }
    },
    {
      ...basePayload,
      temperature: 0,
      response_format: { type: "json_object" }
    },
    {
      ...basePayload,
      reasoning_effort: settings.providerReasoningEffort
    },
    {
      ...basePayload,
      temperature: 0
    }
  ];
}

function parseJsonResponse(content: string): Record<string, unknown> {
  const trimmedContent = content.trim();

  try {
    return JSON.parse(trimmedContent) as Record<string, unknown>;
  } catch {
    const withoutFences = trimmedContent
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    try {
      return JSON.parse(withoutFences) as Record<string, unknown>;
    } catch {
      const objectStart = withoutFences.indexOf("{");
      const objectEnd = withoutFences.lastIndexOf("}");

      if (objectStart >= 0 && objectEnd > objectStart) {
        return JSON.parse(withoutFences.slice(objectStart, objectEnd + 1)) as Record<
          string,
          unknown
        >;
      }

      throw new Error("Could not parse JSON response from the remote provider.");
    }
  }
}

function normalizeSections(value: unknown): ExplanationSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: ExplanationSection[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as { label?: unknown; content?: unknown; items?: unknown };
    const heading =
      "heading" in (entry as Record<string, unknown>)
        ? (entry as Record<string, unknown>).heading
        : undefined;
    const label =
      typeof candidate.label === "string"
        ? candidate.label.trim()
        : typeof heading === "string"
          ? heading.trim()
          : "section";
    const content = typeof candidate.content === "string" ? candidate.content.trim() : "";
    const items = normalizeStringArray(candidate.items);
    const fallbackItems = !items.length ? splitContentIntoItems(content) : items;

    if (!content && !fallbackItems.length) {
      continue;
    }

    normalized.push({
      label,
      content,
      items: fallbackItems.length ? fallbackItems : undefined
    });
  }

  return normalized;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function normalizeGlossaryHints(value: unknown): GlossaryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedEntries: GlossaryEntry[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as {
      term?: unknown;
      meaning?: unknown;
      hint?: unknown;
      category?: unknown;
    };
    const term = typeof candidate.term === "string" ? candidate.term.trim() : undefined;
    const meaning =
      typeof candidate.meaning === "string"
        ? candidate.meaning.trim()
        : typeof candidate.hint === "string"
          ? candidate.hint.trim()
          : undefined;

    if (!term || !meaning) {
      continue;
    }

    const category =
      typeof candidate.category === "string"
        ? (candidate.category as GlossaryEntry["category"])
        : "unknown";

    normalizedEntries.push({
      term,
      normalizedTerm: term.toLowerCase(),
      meaning,
      category,
      references: 0,
      source: "generated",
      updatedAt: new Date().toISOString()
    });
  }

  return normalizedEntries;
}

function normalizePreprocessEntries(
  value: unknown,
  candidates: SymbolPreprocessRequest["candidates"]
): PreprocessedSymbolEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.normalizedTerm, candidate])
  );
  const normalizedEntries: PreprocessedSymbolEntry[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as { term?: unknown; summary?: unknown };
    const term = typeof candidate.term === "string" ? candidate.term.trim() : "";
    const summary = typeof candidate.summary === "string" ? candidate.summary.trim() : "";

    if (!term || !summary) {
      continue;
    }

    const matchedCandidate = candidateMap.get(term.toLowerCase());

    if (!matchedCandidate) {
      continue;
    }

    normalizedEntries.push({
      term: matchedCandidate.term,
      normalizedTerm: matchedCandidate.normalizedTerm,
      category: matchedCandidate.category,
      sourceLine: matchedCandidate.sourceLine,
      summary,
      generatedAt: new Date().toISOString(),
      isPlaceholder: false
    });
  }

  return normalizedEntries;
}

function normalizeSelectedTerms(
  value: unknown,
  candidatePool: PreprocessedSymbolCandidate[]
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const candidateMap = new Map(
    candidatePool.map((candidate) => [candidate.normalizedTerm, candidate.term])
  );
  const selectedTerms: string[] = [];

  for (const entry of value) {
    const term = readSelectedTerm(entry);

    if (!term) {
      continue;
    }

    const matchedTerm = candidateMap.get(term.toLowerCase());

    if (matchedTerm && !selectedTerms.includes(matchedTerm)) {
      selectedTerms.push(matchedTerm);
    }
  }

  return selectedTerms;
}

function readStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readSelectedTerm(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as { term?: unknown; name?: unknown };

  if (typeof candidate.term === "string" && candidate.term.trim()) {
    return candidate.term.trim();
  }

  if (typeof candidate.name === "string" && candidate.name.trim()) {
    return candidate.name.trim();
  }

  return undefined;
}

function extractMessageContent(choice: ChatCompletionChoice | undefined): string | undefined {
  const directCandidates: unknown[] = [
    choice?.text,
    choice?.message?.content,
    choice?.message?.reasoning_content,
    (choice as Record<string, unknown> | undefined)?.delta
  ];

  for (const candidate of directCandidates) {
    const text = extractTextContent(candidate);

    if (text) {
      return text;
    }
  }

  return undefined;
}

function extractTextContent(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => extractTextContent(entry))
      .filter((entry): entry is string => Boolean(entry))
      .join("")
      .trim();

    return joined || undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const objectValue = value as Record<string, unknown>;
  const preferredKeys = [
    "content",
    "text",
    "value",
    "output_text",
    "reasoning_content",
    "refusal"
  ];

  for (const key of preferredKeys) {
    const text = extractTextContent(objectValue[key]);

    if (text) {
      return text;
    }
  }

  return undefined;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function shortenWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function splitContentIntoItems(content: string): string[] {
  return Array.from(
    new Set(
      content
        .split(/\n+|(?<=[。！？；;])\s*/u)
        .map((entry) => entry.replace(/^[-*•\s]+/, "").trim())
        .filter((entry) => entry.length > 0)
    )
  ).slice(0, 4);
}

