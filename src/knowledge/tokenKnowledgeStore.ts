import { ExplanationResponse, TokenKnowledgeEntry } from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { WorkspaceStore } from "../storage/workspaceStore";

export class TokenKnowledgeStore {
  constructor(
    private readonly workspaceStore: WorkspaceStore,
    private readonly logger?: ExtensionLogger
  ) {}

  async find(languageId: string, term: string): Promise<TokenKnowledgeEntry | undefined> {
    const knowledgeFile = await this.workspaceStore.readTokenKnowledge(languageId);
    const normalizedTerm = term.trim().toLowerCase();

    return knowledgeFile.entries.find((entry) => entry.normalizedTerm === normalizedTerm);
  }

  async upsert(
    languageId: string,
    term: string,
    explanation: ExplanationResponse
  ): Promise<TokenKnowledgeEntry> {
    const knowledgeFile = await this.workspaceStore.readTokenKnowledge(languageId);
    const normalizedTerm = term.trim().toLowerCase();
    const now = new Date().toISOString();
    const nextEntry: TokenKnowledgeEntry = {
      languageId,
      term,
      normalizedTerm,
      generatedAt: now,
      updatedAt: now,
      explanation
    };
    const existingIndex = knowledgeFile.entries.findIndex(
      (entry) => entry.normalizedTerm === normalizedTerm
    );

    if (existingIndex >= 0) {
      knowledgeFile.entries[existingIndex] = {
        ...knowledgeFile.entries[existingIndex],
        explanation,
        updatedAt: now
      };
    } else {
      knowledgeFile.entries.push(nextEntry);
    }

    await this.workspaceStore.writeTokenKnowledge(languageId, knowledgeFile);
    this.logger?.info("Token knowledge updated", {
      languageId,
      term,
      totalEntries: knowledgeFile.entries.length
    });

    return (
      knowledgeFile.entries.find((entry) => entry.normalizedTerm === normalizedTerm) ?? nextEntry
    );
  }
}
