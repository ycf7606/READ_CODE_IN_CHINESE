import { promises as fs } from "fs";
import * as path from "path";
import {
  KnowledgeDocument,
  KnowledgeSnippet
} from "../contracts";
import { WorkspaceStore } from "../storage/workspaceStore";
import { createContentHash } from "../utils/hash";
import { shortenText, tokenizeSearchText } from "../utils/text";

interface JsonKnowledgeDocument {
  title?: string;
  content?: string;
  tags?: string[];
}

export class KnowledgeStore {
  constructor(private readonly workspaceStore: WorkspaceStore) {}

  async importDocuments(filePaths: string[]): Promise<KnowledgeDocument[]> {
    const existingLibrary = await this.workspaceStore.readKnowledgeLibrary();
    const importedDocuments: KnowledgeDocument[] = [];

    for (const filePath of filePaths) {
      const rawContent = await fs.readFile(filePath, "utf8");
      const documents = this.extractDocumentsFromFile(filePath, rawContent);

      for (const document of documents) {
        const existingDocumentIndex = existingLibrary.documents.findIndex(
          (entry) => entry.id === document.id
        );

        if (existingDocumentIndex >= 0) {
          existingLibrary.documents[existingDocumentIndex] = document;
        } else {
          existingLibrary.documents.push(document);
        }

        importedDocuments.push(document);
      }
    }

    await this.workspaceStore.writeKnowledgeLibrary(existingLibrary);
    return importedDocuments;
  }

  async search(query: string, topK: number): Promise<KnowledgeSnippet[]> {
    const library = await this.workspaceStore.readKnowledgeLibrary();
    const queryTokens = tokenizeSearchText(query);

    if (queryTokens.length === 0) {
      return [];
    }

    const snippets = library.documents
      .map((document) => {
        const haystackTokens = tokenizeSearchText(
          `${document.title} ${document.tags.join(" ")} ${document.content}`
        );
        const score = queryTokens.reduce(
          (count, token) => count + (haystackTokens.includes(token) ? 1 : 0),
          0
        );

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
      content
    };
  }
}
