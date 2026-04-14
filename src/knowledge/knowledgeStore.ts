import { promises as fs } from "fs";
import * as path from "path";
import {
  KnowledgeDocument,
  KnowledgeSnippet
} from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { WorkspaceStore } from "../storage/workspaceStore";
import { createContentHash } from "../utils/hash";
import { shortenText, tokenizeSearchText } from "../utils/text";

interface JsonKnowledgeDocument {
  title?: string;
  content?: string;
  tags?: string[];
}

export class KnowledgeStore {
  constructor(
    private readonly workspaceStore: WorkspaceStore,
    private readonly logger?: ExtensionLogger
  ) {}

  async importDocuments(filePaths: string[]): Promise<KnowledgeDocument[]> {
    const importedDocuments: KnowledgeDocument[] = [];

    for (const filePath of filePaths) {
      const rawContent = await fs.readFile(filePath, "utf8");
      const documents = this.extractDocumentsFromFile(filePath, rawContent);
      importedDocuments.push(...documents);
    }

    await this.upsertDocuments(importedDocuments);
    return importedDocuments;
  }

  async upsertDocuments(documents: KnowledgeDocument[]): Promise<void> {
    const existingLibrary = await this.workspaceStore.readKnowledgeLibrary();

    for (const document of documents) {
      const existingDocumentIndex = existingLibrary.documents.findIndex(
        (entry) => entry.id === document.id
      );

      if (existingDocumentIndex >= 0) {
        existingLibrary.documents[existingDocumentIndex] = document;
      } else {
        existingLibrary.documents.push(document);
      }
    }

    await this.workspaceStore.writeKnowledgeLibrary(existingLibrary);
    this.logger?.info("Knowledge library updated", {
      addedOrUpdated: documents.length,
      totalDocuments: existingLibrary.documents.length
    });
  }

  async listDocumentsForLanguage(languageId: string): Promise<KnowledgeDocument[]> {
    const library = await this.workspaceStore.readKnowledgeLibrary();
    const normalizedLanguageId = languageId.toLowerCase();

    return library.documents.filter((document) => {
      if (document.languageId?.toLowerCase() === normalizedLanguageId) {
        return true;
      }

      return document.tags.some((tag) => tag.toLowerCase() === normalizedLanguageId);
    });
  }

  async collectTokenCandidates(
    languageId: string,
    preferredTerms: string[],
    limit: number
  ): Promise<string[]> {
    const documents = await this.listDocumentsForLanguage(languageId);
    const rankedTerms = new Map<string, { term: string; score: number }>();

    for (const term of preferredTerms) {
      addRankedTerm(rankedTerms, term, 40);
    }

    for (const document of documents) {
      for (const term of extractIdentifierTerms(document.title)) {
        addRankedTerm(rankedTerms, term, 10);
      }

      for (const tag of document.tags) {
        for (const term of extractIdentifierTerms(tag)) {
          addRankedTerm(rankedTerms, term, 8);
        }
      }

      for (const term of extractIdentifierTerms(document.content)) {
        addRankedTerm(rankedTerms, term, 1);
      }
    }

    return Array.from(rankedTerms.values())
      .sort((left, right) => right.score - left.score || left.term.localeCompare(right.term))
      .slice(0, limit)
      .map((entry) => entry.term);
  }

  async search(query: string, topK: number): Promise<KnowledgeSnippet[]> {
    const library = await this.workspaceStore.readKnowledgeLibrary();
    const queryTokens = tokenizeSearchText(query);

    if (queryTokens.length === 0) {
      return [];
    }

    const snippets = library.documents
      .map((document) => {
        const titleTokens = tokenizeSearchText(document.title);
        const tagTokens = tokenizeSearchText(document.tags.join(" "));
        const contentTokens = tokenizeSearchText(document.content);
        const score = queryTokens.reduce((count, token) => {
          const titleBoost = titleTokens.includes(token) ? 4 : 0;
          const tagBoost = tagTokens.includes(token) ? 2 : 0;
          const contentBoost = contentTokens.includes(token) ? 1 : 0;

          return count + titleBoost + tagBoost + contentBoost;
        }, 0);

        return {
          documentId: document.id,
          title: document.title,
          excerpt: shortenText(document.content.replace(/\s+/g, " "), 240),
          score
        };
      })
      .filter((snippet) => snippet.score > 0)
      .sort((left, right) => right.score - left.score);

    return snippets.slice(0, topK);
  }

  private extractDocumentsFromFile(filePath: string, rawContent: string): KnowledgeDocument[] {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".json") {
      const parsed = JSON.parse(rawContent) as JsonKnowledgeDocument | JsonKnowledgeDocument[];
      const documents = Array.isArray(parsed) ? parsed : [parsed];

      return documents
        .filter((document) => document.title && document.content)
        .map((document, index) =>
          this.createDocument(
            filePath,
            document.title ?? path.basename(filePath, extension),
            document.content ?? "",
            document.tags ?? [],
            index
          )
        );
    }

    return [
      this.createDocument(
        filePath,
        path.basename(filePath, extension),
        rawContent,
        path.dirname(filePath).split(path.sep).filter(Boolean),
        0
      )
    ];
  }

  private createDocument(
    filePath: string,
    title: string,
    content: string,
    tags: string[],
    index: number
  ): KnowledgeDocument {
    return {
      id: createContentHash(`${filePath}:${index}:${title}`),
      title,
      sourcePath: filePath,
      importedAt: new Date().toISOString(),
      tags,
      content,
      sourceType: "imported"
    };
  }
}

const TOKEN_STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "briefly",
  "chapter",
  "code",
  "current",
  "default",
  "details",
  "document",
  "docs",
  "each",
  "example",
  "examples",
  "false",
  "first",
  "following",
  "guide",
  "handbook",
  "into",
  "language",
  "learn",
  "manual",
  "module",
  "notes",
  "overview",
  "page",
  "pages",
  "reference",
  "returns",
  "section",
  "should",
  "shows",
  "source",
  "statement",
  "syntax",
  "their",
  "these",
  "this",
  "through",
  "title",
  "true",
  "using",
  "value",
  "values",
  "where",
  "while",
  "with"
]);

function extractIdentifierTerms(content: string): string[] {
  const terms = content.match(/\b[A-Za-z_][A-Za-z0-9_]{2,39}\b/g) ?? [];

  return terms.filter((term) => {
    const normalizedTerm = term.toLowerCase();

    if (TOKEN_STOP_WORDS.has(normalizedTerm)) {
      return false;
    }

    return !/^\d/.test(term);
  });
}

function addRankedTerm(
  rankedTerms: Map<string, { term: string; score: number }>,
  term: string,
  score: number
): void {
  const trimmedTerm = term.trim();

  if (!trimmedTerm) {
    return;
  }

  const normalizedTerm = trimmedTerm.toLowerCase();
  const existing = rankedTerms.get(normalizedTerm);
  const preferredTerm =
    existing && isBetterDisplayTerm(existing.term, trimmedTerm) ? existing.term : trimmedTerm;
  const displayBoost = /[A-Z_]/.test(trimmedTerm) ? 2 : 0;

  rankedTerms.set(normalizedTerm, {
    term: preferredTerm,
    score: (existing?.score ?? 0) + score + displayBoost
  });
}

function isBetterDisplayTerm(currentTerm: string, nextTerm: string): boolean {
  if (/[A-Z_]/.test(currentTerm) && !/[A-Z_]/.test(nextTerm)) {
    return true;
  }

  if (!/[A-Z_]/.test(currentTerm) && /[A-Z_]/.test(nextTerm)) {
    return false;
  }

  return currentTerm.length <= nextTerm.length;
}
