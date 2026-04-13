import {
  ChatTurn,
  ExplanationRequest,
  ExplanationResponse,
  ExtensionSettings,
  FollowUpRequest,
  FollowUpResponse,
  GlossaryEntry
} from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import {
  buildExplainPrompts,
  buildFollowUpPrompts
} from "../prompts/openAICompatiblePrompt";
import { ExplanationProvider } from "./providerTypes";

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionChoice {
  message?: {
    content?: string | Array<{
      type?: string;
      text?: string;
    }>;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

export class OpenAICompatibleProvider implements ExplanationProvider {
  readonly id = "openai-compatible";

  constructor(
    private readonly settings: ExtensionSettings,
    private readonly logger?: ExtensionLogger
  ) {}

  async explain(request: ExplanationRequest): Promise<ExplanationResponse> {
    const startedAt = Date.now();
    const prompts = buildExplainPrompts(request);
    const content = await this.createChatCompletion(
      [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ],
      "explain"
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

  async answerFollowUp(request: FollowUpRequest): Promise<FollowUpResponse> {
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
      "follow-up"
    );

    this.logger?.info("Remote provider answered follow-up", {
      requestId: request.request.requestId,
      model: this.settings.providerModel
    });

    return {
      answer: content.trim(),
      suggestedQuestions: [
        "它和上游调用链的关系是什么？",
        "这里有没有隐藏的副作用或状态变化？"
      ],
      source: this.id,
      latencyMs: Date.now() - startedAt
    };
  }

  private async createChatCompletion(
    messages: ChatCompletionMessage[],
    mode: "explain" | "follow-up"
  ): Promise<string> {
    const apiKey = process.env[this.settings.providerApiKeyEnvVar];

    if (!apiKey) {
      throw new Error(
        `Environment variable ${this.settings.providerApiKeyEnvVar} is not set.`
      );
    }

    const baseUrl = this.settings.providerBaseUrl.replace(/\/+$/, "");

    if (!baseUrl || !this.settings.providerModel) {
      throw new Error("Provider base URL and model are required for remote requests.");
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      this.settings.providerTimeoutMs
    );

    this.logger?.info("Sending remote provider request", {
      mode,
      baseUrl,
      model: this.settings.providerModel,
      messageCount: messages.length,
      temperature: this.settings.providerTemperature,
      topP: this.settings.providerTopP,
      maxTokens: this.settings.providerMaxTokens
    });

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.settings.providerModel,
          temperature: this.settings.providerTemperature,
          top_p: this.settings.providerTopP,
          max_tokens: this.settings.providerMaxTokens,
          messages
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await safeReadText(response);
        throw new Error(
          `Remote provider returned ${response.status} ${response.statusText}. ${shortenWhitespace(errorText)}`
        );
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const content = extractMessageContent(payload.choices?.[0]);

      if (!content) {
        throw new Error("Remote provider did not return a message content.");
      }

      return content;
    } catch (error) {
      this.logger?.error("Remote provider request failed", error);
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
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

function normalizeSections(value: unknown): Array<{ label: string; content: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return undefined;
      }

      const candidate = entry as { label?: unknown; content?: unknown };
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "section";
      const content = typeof candidate.content === "string" ? candidate.content.trim() : "";

      return { label, content };
    })
    .filter(
      (entry): entry is { label: string; content: string } =>
        Boolean(entry && entry.content)
    );
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
      category?: unknown;
    };
    const term = typeof candidate.term === "string" ? candidate.term.trim() : undefined;
    const meaning =
      typeof candidate.meaning === "string" ? candidate.meaning.trim() : undefined;

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

function readStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function extractMessageContent(choice: ChatCompletionChoice | undefined): string | undefined {
  const content = choice?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => (entry?.type === "text" && entry.text ? entry.text : ""))
      .join("")
      .trim();
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
