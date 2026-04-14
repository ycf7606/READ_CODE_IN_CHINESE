import {
  ExplanationRequest,
  ExplanationResponse,
  ExtensionSettings,
  GlossaryEntry,
  PreprocessedSymbolCacheFile,
  PreprocessedSymbolCandidate,
  PreprocessedSymbolEntry,
  PreprocessProgress,
  SymbolPreprocessRequest
} from "../contracts";
import { ExtensionLogger } from "../logging/logger";
import { ExplanationProvider } from "../providers/providerTypes";
import { WorkspaceStore } from "../storage/workspaceStore";
import { createContentHash } from "../utils/hash";
import { buildPreprocessCandidates } from "../analysis/preprocess";
import { PreprocessStore } from "./preprocessStore";

export interface BuildSymbolPreprocessOptions {
  editorText: string;
  languageId: string;
  filePath: string;
  relativeFilePath: string;
  settings: ExtensionSettings;
  glossaryEntries: GlossaryEntry[];
  workspaceStore: WorkspaceStore;
  provider: ExplanationProvider;
  logger?: ExtensionLogger;
  signal?: AbortSignal;
  onProgress?: (progress: PreprocessProgress) => void;
}

export interface SymbolPreprocessResult {
  cacheFile: PreprocessedSymbolCacheFile;
  candidates: PreprocessedSymbolCandidate[];
  source: string;
}

export function buildCachedPreprocessExplanation(
  request: ExplanationRequest,
  entry: PreprocessedSymbolEntry
): ExplanationResponse {
  return {
    requestId: request.requestId,
    title: `${entry.term} Quick Meaning`,
    summary: entry.summary,
    sections: [
      {
        label: "summary",
        content: entry.summary
      }
    ],
    suggestedQuestions: [
      "这个符号在当前函数里具体接收了什么值？",
      "它和上游调用链是什么关系？"
    ],
    glossaryHints: request.glossaryEntries.filter(
      (glossaryEntry) => glossaryEntry.normalizedTerm === entry.normalizedTerm
    ),
    granularity: "token",
    selectionText: request.selectedText,
    source: "preprocess-cache",
    latencyMs: 0,
    note: "Used the file-level preprocessing cache for a quick symbol explanation.",
    knowledgeUsed: []
  };
}

export async function buildSymbolPreprocessCache(
  options: BuildSymbolPreprocessOptions
): Promise<SymbolPreprocessResult | undefined> {
  if (!options.provider.preprocessSymbols) {
    return undefined;
  }

  const preprocessStore = new PreprocessStore(options.workspaceStore);
  const sourceHash = createContentHash(options.editorText);
  const existingCache = await preprocessStore.read(options.relativeFilePath);
  const candidates = buildPreprocessCandidates(
    options.glossaryEntries,
    options.settings.professionalLevel,
    options.settings.occupation
  );

  if (existingCache && existingCache.sourceHash === sourceHash) {
    options.onProgress?.(
      createProgress(
        "completed",
        candidates.length,
        candidates.length,
        sourceHash,
        options.relativeFilePath,
        {
          completedAt: new Date().toISOString(),
          message: `Preprocessed ${existingCache.entries.length} symbols from cache.`
        }
      )
    );
    return {
      cacheFile: existingCache,
      candidates,
      source: "cache"
    };
  }

  if (candidates.length === 0) {
    const emptyCache: PreprocessedSymbolCacheFile = {
      languageId: options.languageId,
      relativeFilePath: options.relativeFilePath,
      sourceHash,
      generatedAt: new Date().toISOString(),
      entries: []
    };
    await preprocessStore.write(options.relativeFilePath, emptyCache);
    options.onProgress?.(
      createProgress("completed", 0, 0, sourceHash, options.relativeFilePath, {
        completedAt: new Date().toISOString(),
        message: "No user-defined symbols need preprocessing in this file."
      })
    );
    return {
      cacheFile: emptyCache,
      candidates: [],
      source: "empty"
    };
  }

  options.onProgress?.(
    createProgress("running", candidates.length, 0, sourceHash, options.relativeFilePath, {
      currentStep: "Preparing symbol batch",
      message: `Found ${candidates.length} symbols to preprocess.`
    })
  );

  const request: SymbolPreprocessRequest = {
    requestId: createContentHash(
      [
        "symbol-preprocess",
        options.languageId,
        options.relativeFilePath,
        sourceHash,
        candidates.map((candidate) => candidate.term).join(",")
      ].join(":")
    ),
    languageId: options.languageId,
    filePath: options.filePath,
    relativeFilePath: options.relativeFilePath,
    professionalLevel: options.settings.professionalLevel,
    occupation: options.settings.occupation,
    sourceCode: options.editorText,
    candidates,
    userGoal: options.settings.userGoal,
    customInstructions: options.settings.customInstructions
  };

  options.onProgress?.(
    createProgress("running", candidates.length, 0, sourceHash, options.relativeFilePath, {
      completedSteps: 1,
      currentStep: "Sending batch request",
      message: `Processing ${candidates.length} symbols in 1 batch.`
    })
  );

  const response = await options.provider.preprocessSymbols(request, {
    signal: options.signal
  });

  const entryMap = new Map(
    response.entries.map((entry) => [entry.normalizedTerm, entry])
  );
  const normalizedEntries = candidates.map((candidate) => {
    const existingEntry = entryMap.get(candidate.normalizedTerm);

    return (
      existingEntry ?? {
        term: candidate.term,
        normalizedTerm: candidate.normalizedTerm,
        category: candidate.category,
        sourceLine: candidate.sourceLine,
        summary: `\`${candidate.term}\` 是当前文件里的一个关键${candidate.category === "function" ? "函数" : "符号"}。`,
        generatedAt: new Date().toISOString()
      }
    );
  });
  const cacheFile: PreprocessedSymbolCacheFile = {
    languageId: options.languageId,
    relativeFilePath: options.relativeFilePath,
    sourceHash,
    generatedAt: new Date().toISOString(),
    entries: normalizedEntries
  };

  options.onProgress?.(
    createProgress(
      "running",
      candidates.length,
      normalizedEntries.length,
      sourceHash,
      options.relativeFilePath,
      {
        completedSteps: 2,
        currentStep: "Saving cache",
        message: `Saving ${normalizedEntries.length} symbol explanations.`
      }
    )
  );

  await preprocessStore.write(options.relativeFilePath, cacheFile);
  options.logger?.info("Symbol preprocessing completed", {
    relativeFilePath: options.relativeFilePath,
    languageId: options.languageId,
    symbolCount: normalizedEntries.length,
    source: response.source
  });

  options.onProgress?.(
    createProgress(
      "completed",
      candidates.length,
      normalizedEntries.length,
      sourceHash,
      options.relativeFilePath,
      {
        completedAt: new Date().toISOString(),
        completedSteps: 3,
        currentStep: "Completed",
        message: `Preprocessed ${normalizedEntries.length} symbols.`
      }
    )
  );

  return {
    cacheFile,
    candidates,
    source: response.source
  };
}

function createProgress(
  status: PreprocessProgress["status"],
  totalCandidates: number,
  processedCandidates: number,
  sourceHash: string,
  relativeFilePath: string,
  overrides?: Partial<PreprocessProgress>
): PreprocessProgress {
  return {
    status,
    totalCandidates,
    processedCandidates,
    totalSteps: 3,
    completedSteps: status === "completed" ? 3 : 0,
    batchCount: totalCandidates > 0 ? 1 : 0,
    relativeFilePath,
    sourceHash,
    startedAt: new Date().toISOString(),
    ...overrides
  };
}
