import {
  ExplanationResponse,
  SelectionSymbolOrigin,
  TokenKnowledgeEntry
} from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { WorkspaceStore } from "../storage/workspaceStore";

export class TokenKnowledgeStore {
  constructor(
    private readonly workspaceStore: WorkspaceStore,
    private readonly logger?: ExtensionLogger
  ) {}

  async find(
    languageId: string,
    identity: string | TokenKnowledgeIdentity
  ): Promise<TokenKnowledgeEntry | undefined> {
    const knowledgeFile = await this.workspaceStore.readTokenKnowledge(languageId);
    const normalizedIdentity = normalizeIdentity(identity);
    const cacheKey = createTokenKnowledgeCacheKey(normalizedIdentity);
    const exactEntry = knowledgeFile.entries.find((entry) => entry.cacheKey === cacheKey);

    if (exactEntry) {
      return exactEntry;
    }

    if (typeof identity !== "string") {
      return undefined;
    }

    return knowledgeFile.entries.find(
      (entry) => !entry.cacheKey && entry.normalizedTerm === normalizedIdentity.term.toLowerCase()
    );
  }

  async upsert(
    languageId: string,
    identity: string | TokenKnowledgeIdentity,
    explanation: ExplanationResponse
  ): Promise<TokenKnowledgeEntry> {
    const knowledgeFile = await this.workspaceStore.readTokenKnowledge(languageId);
    const normalizedIdentity = normalizeIdentity(identity);
    const normalizedTerm = normalizedIdentity.term.toLowerCase();
    const cacheKey = createTokenKnowledgeCacheKey(normalizedIdentity);
    const now = new Date().toISOString();
    const nextEntry: TokenKnowledgeEntry = {
      languageId,
      term: normalizedIdentity.term,
      normalizedTerm,
      cacheKey,
      ...(normalizedIdentity.qualifiedName
        ? { qualifiedName: normalizedIdentity.qualifiedName }
        : {}),
      ...(normalizedIdentity.origin ? { origin: normalizedIdentity.origin } : {}),
      ...(normalizedIdentity.contextHash
        ? { contextHash: normalizedIdentity.contextHash }
        : {}),
      generatedAt: now,
      updatedAt: now,
      explanation
    };
    const existingIndex = knowledgeFile.entries.findIndex(
      (entry) => entry.cacheKey === cacheKey
    );

    if (existingIndex >= 0) {
      knowledgeFile.entries[existingIndex] = {
        ...knowledgeFile.entries[existingIndex],
        term: normalizedIdentity.term,
        normalizedTerm,
        cacheKey,
        qualifiedName: normalizedIdentity.qualifiedName,
        origin: normalizedIdentity.origin,
        contextHash: normalizedIdentity.contextHash,
        explanation,
        updatedAt: now
      };
    } else {
      knowledgeFile.entries.push(nextEntry);
    }

    await this.workspaceStore.writeTokenKnowledge(languageId, knowledgeFile);
    this.logger?.info("Token knowledge updated", {
      languageId,
      term: normalizedIdentity.term,
      cacheKey,
      totalEntries: knowledgeFile.entries.length
    });

    return (
      knowledgeFile.entries.find((entry) => entry.cacheKey === cacheKey) ?? nextEntry
    );
  }
}

export interface TokenKnowledgeIdentity {
  term: string;
  qualifiedName?: string;
  origin?: SelectionSymbolOrigin;
  contextHash?: string;
}

export function createTokenKnowledgeCacheKey(identity: TokenKnowledgeIdentity): string {
  const normalized = normalizeIdentity(identity);
  return [
    "v2",
    normalized.origin ?? "unknown",
    (normalized.qualifiedName ?? normalized.term).toLowerCase(),
    normalized.contextHash ?? ""
  ].join(":");
}

function normalizeIdentity(
  identity: string | TokenKnowledgeIdentity
): TokenKnowledgeIdentity {
  if (typeof identity === "string") {
    return { term: identity.trim() };
  }

  return {
    term: identity.term.trim(),
    ...(identity.qualifiedName?.trim()
      ? { qualifiedName: identity.qualifiedName.trim() }
      : {}),
    ...(identity.origin ? { origin: identity.origin } : {}),
    ...(identity.contextHash?.trim() ? { contextHash: identity.contextHash.trim() } : {})
  };
}
