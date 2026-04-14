import {
  ExplanationRequest,
  ExplanationResponse,
  ExtensionSettings,
  GlossaryEntry
} from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { ExplanationProvider } from "../providers/providerTypes";
import { createContentHash } from "../utils/hash";
import { KnowledgeStore } from "./knowledgeStore";
import { TokenKnowledgeStore } from "./tokenKnowledgeStore";

export interface BuildSingleTokenKnowledgeOptions {
  languageId: string;
  filePath: string;
  relativeFilePath: string;
  term: string;
  settings: ExtensionSettings;
  glossaryEntries: GlossaryEntry[];
  knowledgeStore: KnowledgeStore;
  tokenKnowledgeStore: TokenKnowledgeStore;
  provider: ExplanationProvider;
  logger?: ExtensionLogger;
  contextBefore?: string;
  contextAfter?: string;
}

export interface BuildTokenKnowledgeBatchOptions {
  languageId: string;
  filePath: string;
  relativeFilePath: string;
  settings: ExtensionSettings;
  glossaryEntries: GlossaryEntry[];
  knowledgeStore: KnowledgeStore;
  tokenKnowledgeStore: TokenKnowledgeStore;
  provider: ExplanationProvider;
  logger?: ExtensionLogger;
  preferredTerms?: string[];
  limit: number;
  onProgress?: (payload: {
    current: number;
    total: number;
    term: string;
  }) => void;
}

export interface TokenKnowledgeBuildResult {
  languageId: string;
  sourceDocumentCount: number;
  requestedTerms: string[];
  built: number;
  skipped: number;
  failedTerms: string[];
}

export async function buildSingleTokenKnowledge(
  options: BuildSingleTokenKnowledgeOptions
): Promise<ExplanationResponse | undefined> {
  if (options.provider.id !== "openai-compatible") {
    return undefined;
  }

  const request = await createTokenKnowledgeRequest(options);

  try {
    const response = await options.provider.explain(request);

    if (response.source !== "openai-compatible") {
      return undefined;
    }

    const normalizedResponse: ExplanationResponse = {
      ...response,
      note:
        response.note ??
        "Prepared from synced knowledge and remote model reasoning for token reuse."
    };

    await options.tokenKnowledgeStore.upsert(
      options.languageId,
      options.term,
      normalizedResponse
    );

    return normalizedResponse;
  } catch (error) {
    options.logger?.warn("Token knowledge build failed", {
      languageId: options.languageId,
      term: options.term,
      error: error instanceof Error ? error.message : String(error)
    });
    return undefined;
  }
}

export async function buildTokenKnowledgeBatch(
  options: BuildTokenKnowledgeBatchOptions
): Promise<TokenKnowledgeBuildResult> {
  const requestedTerms = await options.knowledgeStore.collectTokenCandidates(
    options.languageId,
    options.preferredTerms ?? [],
    options.limit
  );
  const sourceDocuments = await options.knowledgeStore.listDocumentsForLanguage(
    options.languageId
  );
  const failedTerms: string[] = [];
  let built = 0;
  let skipped = 0;

  for (const [index, term] of requestedTerms.entries()) {
    options.onProgress?.({
      current: index + 1,
      total: requestedTerms.length,
      term
    });

    const cached = await options.tokenKnowledgeStore.find(options.languageId, term);

    if (cached) {
      skipped += 1;
      continue;
    }

    const response = await buildSingleTokenKnowledge({
      languageId: options.languageId,
      filePath: options.filePath,
      relativeFilePath: options.relativeFilePath,
      term,
      settings: options.settings,
      glossaryEntries: options.glossaryEntries,
      knowledgeStore: options.knowledgeStore,
      tokenKnowledgeStore: options.tokenKnowledgeStore,
      provider: options.provider,
      logger: options.logger
    });

    if (response) {
      built += 1;
    } else {
      failedTerms.push(term);
    }
  }

  return {
    languageId: options.languageId,
    sourceDocumentCount: sourceDocuments.length,
    requestedTerms,
    built,
    skipped,
    failedTerms
  };
}

async function createTokenKnowledgeRequest(
  options: BuildSingleTokenKnowledgeOptions
): Promise<ExplanationRequest> {
  const knowledgeSnippets = await options.knowledgeStore.search(
    [
      options.languageId,
      options.term,
      options.contextBefore ?? "",
      options.contextAfter ?? ""
    ].join("\n"),
    Math.max(4, options.settings.knowledgeTopK)
  );
  const prioritizedGlossaryEntries = options.glossaryEntries
    .slice()
    .sort((left, right) => {
      const leftMatch = left.normalizedTerm === options.term.toLowerCase() ? 1 : 0;
      const rightMatch = right.normalizedTerm === options.term.toLowerCase() ? 1 : 0;
      return rightMatch - leftMatch;
    })
    .slice(0, 12);

  return {
    requestId: createContentHash(
      [
        "token-prebuild",
        options.languageId,
        options.relativeFilePath,
        options.term,
        options.contextBefore ?? "",
        options.contextAfter ?? "",
        options.settings.detailLevel,
        options.settings.professionalLevel
      ].join(":")
    ),
    reason: "prebuild",
    languageId: options.languageId,
    filePath: options.filePath,
    relativeFilePath: options.relativeFilePath,
    selectedText: options.term,
    selectionPreview: `${options.contextBefore ?? ""}[[${options.term}]]${options.contextAfter ?? ""}`,
    granularity: "token",
    detailLevel: options.settings.detailLevel,
    occupation: options.settings.occupation,
    professionalLevel: options.settings.professionalLevel,
    sections: options.settings.sections,
    userGoal:
      options.settings.userGoal || "Build a reusable token explanation for later code reading.",
    customInstructions: options.settings.customInstructions,
    contextBefore: options.contextBefore ?? "",
    contextAfter: options.contextAfter ?? "",
    glossaryEntries: prioritizedGlossaryEntries,
    knowledgeSnippets
  };
}
