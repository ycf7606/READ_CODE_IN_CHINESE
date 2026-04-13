import * as http from "http";
import * as https from "https";
import { KnowledgeDocument } from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { createContentHash } from "../utils/hash";
import { shortenText } from "../utils/text";

interface OfficialDocumentSource {
  title: string;
  url: string;
  tags: string[];
}

interface OfficialDocsPreset {
  languageId: string;
  label: string;
  documents: OfficialDocumentSource[];
}

export interface OfficialDocsSyncResult {
  languageId: string;
  label: string;
  importedDocuments: KnowledgeDocument[];
  failedSources: string[];
}

const DEFAULT_HEADERS = {
  "User-Agent": "READ_CODE_IN_CHINESE/0.3.0",
  Accept: "text/html, text/plain, application/json",
  "Accept-Encoding": "identity"
};

const MAX_TEXT_LENGTH = 18000;
const CHUNK_SIZE = 1800;

const OFFICIAL_DOCS_PRESETS: OfficialDocsPreset[] = [
  {
    languageId: "typescript",
    label: "TypeScript",
    documents: [
      {
        title: "TypeScript Handbook: Everyday Types",
        url: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html",
        tags: ["typescript", "official-doc", "types"]
      },
      {
        title: "TypeScript Handbook: Functions",
        url: "https://www.typescriptlang.org/docs/handbook/2/functions.html",
        tags: ["typescript", "official-doc", "functions"]
      },
      {
        title: "TypeScript Handbook: Narrowing",
        url: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html",
        tags: ["typescript", "official-doc", "control-flow"]
      }
    ]
  },
  {
    languageId: "typescriptreact",
    label: "TypeScript",
    documents: [
      {
        title: "TypeScript Handbook: Everyday Types",
        url: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html",
        tags: ["typescript", "official-doc", "types"]
      },
      {
        title: "TypeScript Handbook: Functions",
        url: "https://www.typescriptlang.org/docs/handbook/2/functions.html",
        tags: ["typescript", "official-doc", "functions"]
      },
      {
        title: "TypeScript Handbook: JSX",
        url: "https://www.typescriptlang.org/docs/handbook/jsx.html",
        tags: ["typescript", "official-doc", "jsx"]
      }
    ]
  },
  {
    languageId: "javascript",
    label: "JavaScript",
    documents: [
      {
        title: "MDN JavaScript Guide: Functions",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions",
        tags: ["javascript", "reference-doc", "functions"]
      },
      {
        title: "MDN JavaScript Reference: async function",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function",
        tags: ["javascript", "reference-doc", "async"]
      },
      {
        title: "MDN JavaScript Reference: Promise",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise",
        tags: ["javascript", "reference-doc", "promise"]
      }
    ]
  },
  {
    languageId: "javascriptreact",
    label: "JavaScript",
    documents: [
      {
        title: "MDN JavaScript Guide: Functions",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions",
        tags: ["javascript", "reference-doc", "functions"]
      },
      {
        title: "MDN JavaScript Reference: async function",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function",
        tags: ["javascript", "reference-doc", "async"]
      },
      {
        title: "MDN JavaScript Reference: Promise",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise",
        tags: ["javascript", "reference-doc", "promise"]
      }
    ]
  },
  {
    languageId: "python",
    label: "Python",
    documents: [
      {
        title: "Python Tutorial: Control Flow Tools",
        url: "https://docs.python.org/3/tutorial/controlflow.html",
        tags: ["python", "official-doc", "control-flow"]
      },
      {
        title: "Python Reference: Compound Statements",
        url: "https://docs.python.org/3/reference/compound_stmts.html",
        tags: ["python", "official-doc", "statements"]
      },
      {
        title: "Python Library Reference: Built-in Functions",
        url: "https://docs.python.org/3/library/functions.html",
        tags: ["python", "official-doc", "builtins"]
      }
    ]
  },
  {
    languageId: "go",
    label: "Go",
    documents: [
      {
        title: "Go Language Specification",
        url: "https://go.dev/ref/spec",
        tags: ["go", "official-doc", "spec"]
      },
      {
        title: "Effective Go",
        url: "https://go.dev/doc/effective_go",
        tags: ["go", "official-doc", "effective-go"]
      },
      {
        title: "Go by Example: Functions",
        url: "https://gobyexample.com/functions",
        tags: ["go", "reference-doc", "functions"]
      }
    ]
  },
  {
    languageId: "rust",
    label: "Rust",
    documents: [
      {
        title: "The Rust Book: Functions",
        url: "https://doc.rust-lang.org/book/ch03-03-how-functions-work.html",
        tags: ["rust", "official-doc", "functions"]
      },
      {
        title: "Rust Reference: Expressions",
        url: "https://doc.rust-lang.org/reference/expressions.html",
        tags: ["rust", "official-doc", "expressions"]
      },
      {
        title: "Rust Standard Library",
        url: "https://doc.rust-lang.org/std/",
        tags: ["rust", "official-doc", "standard-library"]
      }
    ]
  },
  {
    languageId: "java",
    label: "Java",
    documents: [
      {
        title: "The Java Tutorials: Defining Methods",
        url: "https://docs.oracle.com/javase/tutorial/java/javaOO/methods.html",
        tags: ["java", "official-doc", "methods"]
      },
      {
        title: "Java Language Specification: Blocks and Statements",
        url: "https://docs.oracle.com/javase/specs/jls/se21/html/jls-14.html",
        tags: ["java", "official-doc", "statements"]
      },
      {
        title: "Java SE API Documentation",
        url: "https://docs.oracle.com/en/java/javase/21/docs/api/index.html",
        tags: ["java", "official-doc", "api"]
      }
    ]
  }
];

export function getOfficialDocsPreset(languageId: string): OfficialDocsPreset | undefined {
  return OFFICIAL_DOCS_PRESETS.find((preset) => preset.languageId === languageId);
}

export async function syncOfficialDocsForLanguage(
  languageId: string,
  logger: ExtensionLogger
): Promise<OfficialDocsSyncResult> {
  const preset = getOfficialDocsPreset(languageId);

  if (!preset) {
    throw new Error(`No official docs preset is defined for language: ${languageId}`);
  }

  const importedDocuments: KnowledgeDocument[] = [];
  const failedSources: string[] = [];

  for (const source of preset.documents) {
    logger.info("Syncing official doc", {
      languageId,
      title: source.title,
      url: source.url
    });

    try {
      const rawText = await downloadText(source.url);
      const extractedText = shortenText(extractPlainText(rawText), MAX_TEXT_LENGTH);

      if (!extractedText.trim()) {
        logger.warn("Official doc fetch returned empty text", {
          languageId,
          url: source.url
        });
        failedSources.push(source.url);
        continue;
      }

      const chunks = chunkText(extractedText, CHUNK_SIZE);

      for (const [index, chunk] of chunks.entries()) {
        importedDocuments.push({
          id: createContentHash(`${preset.languageId}:${source.url}:${index}`),
          title: `${source.title}${chunks.length > 1 ? ` #${index + 1}` : ""}`,
          sourcePath: source.url,
          importedAt: new Date().toISOString(),
          tags: [...source.tags, preset.languageId],
          content: chunk,
          sourceType: "official-doc",
          languageId: preset.languageId,
          canonicalUrl: source.url
        });
      }
    } catch (error) {
      logger.warn("Official doc fetch failed", {
        url: source.url,
        error: error instanceof Error ? error.message : String(error)
      });
      failedSources.push(source.url);
    }
  }

  return {
    languageId: preset.languageId,
    label: preset.label,
    importedDocuments,
    failedSources
  };
}

function extractPlainText(rawText: string): string {
  const withoutScripts = rawText
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  return withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(content: string, maxChunkSize: number): string[] {
  if (content.length <= maxChunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining.trim());
      break;
    }

    let boundary = remaining.lastIndexOf(". ", maxChunkSize);

    if (boundary < maxChunkSize / 2) {
      boundary = remaining.lastIndexOf(" ", maxChunkSize);
    }

    if (boundary < maxChunkSize / 3) {
      boundary = maxChunkSize;
    }

    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }

  return chunks.filter(Boolean).slice(0, 18);
}

async function downloadText(url: string, redirectCount = 0): Promise<string> {
  if (redirectCount > 5) {
    throw new Error(`Too many redirects while fetching ${url}`);
  }

  const client = url.startsWith("https:") ? https : http;

  return new Promise<string>((resolve, reject) => {
    const request = client.get(
      url,
      {
        headers: DEFAULT_HEADERS,
        timeout: 30000
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;

        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          typeof response.headers.location === "string"
        ) {
          response.resume();
          const redirectUrl = new URL(response.headers.location, url).toString();
          void downloadText(redirectUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Failed to fetch ${url}: ${statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
        response.on("error", reject);
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Timed out while fetching ${url}`));
    });
    request.on("error", reject);
  });
}
