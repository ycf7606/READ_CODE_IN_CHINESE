import {
  ExplanationRequest,
  ExplanationResponse,
  ExtensionSettings,
  GlossaryEntry,
  PreprocessCandidateSelectionRequest,
  PreprocessedSymbolCacheFile,
  PreprocessedSymbolCandidate,
  PreprocessedSymbolEntry,
  PreprocessProgress,
  SymbolPreprocessRequest
} from "../contracts";
import {
  buildPreprocessCandidatePool,
  selectPreprocessCandidatesFromPool
} from "../analysis/preprocess";
import { ExtensionLogger } from "../logging/logger";
import { generatePreprocessAudiencePrompt } from "../prompts/globalPromptProfile";
import { ExplanationProvider } from "../providers/providerTypes";
import { WorkspaceStore } from "../storage/workspaceStore";
import { createContentHash } from "../utils/hash";
import { PreprocessStore } from "./preprocessStore";

export interface BuildSymbolPreprocessOptions {
  editorText: string;
  languageId: string;
  filePath: string;
  relativeFilePath: string;
  settings: ExtensionSettings;
  glossaryEntries: GlossaryEntry[];
  candidatePool?: PreprocessedSymbolCandidate[];
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
        content: entry.summary,
        items: [entry.summary]
      }
    ],
    suggestedQuestions: [
      "这个符号在当前语句里具体接收了什么值？",
      "它和上游调用链之间是什么关系？"
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
  const candidatePool =
    options.candidatePool ?? buildPreprocessCandidatePool(options.glossaryEntries);

  options.onProgress?.(
    createProgress("running", candidatePool.length, 0, sourceHash, options.relativeFilePath, {
      completedSteps: 1,
      currentStep: "Preparing candidate pool",
      message: `Prepared ${candidatePool.length} preprocessable symbols for this file.`
    })
  );

  const existingCache = await preprocessStore.read(options.relativeFilePath);

  if (existingCache && existingCache.sourceHash === sourceHash) {
    const cachedCandidates = matchCandidatesToEntries(candidatePool, existingCache.entries);

    options.onProgress?.(
      createProgress(
        "completed",
        cachedCandidates.length,
        existingCache.entries.length,
        sourceHash,
        options.relativeFilePath,
        {
          completedAt: new Date().toISOString(),
          completedSteps: 5,
          currentStep: "Completed",
          message: `Loaded ${existingCache.entries.length} cached wordbook entries.`
        }
      )
    );

    return {
      cacheFile: existingCache,
      candidates: cachedCandidates,
      source: "cache"
    };
  }

  const candidates = await selectCandidatesForPreprocess(options, candidatePool, sourceHash);

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
        completedSteps: 5,
        currentStep: "Completed",
        message: "No file-local symbols were selected for the current audience profile."
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
      completedSteps: 3,
      currentStep: "Sending batch request",
      message: `Selected ${candidates.length} wordbook terms and started 1 batch request.`
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
    customInstructions: generatePreprocessAudiencePrompt({
      occupation: options.settings.occupation,
      professionalLevel: options.settings.professionalLevel,
      detailLevel: options.settings.detailLevel,
      userGoal: options.settings.userGoal
    })
  };

  const response = await options.provider.preprocessSymbols(request, {
    signal: options.signal
  });
  const normalizedEntries = normalizePreprocessEntries(candidates, response.entries);
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
        completedSteps: 4,
        currentStep: "Saving cache",
        message: `Saving ${normalizedEntries.length} wordbook entries.`
      }
    )
  );

  await preprocessStore.write(options.relativeFilePath, cacheFile);
  options.logger?.info("Symbol preprocessing completed", {
    relativeFilePath: options.relativeFilePath,
    languageId: options.languageId,
    candidatePoolSize: candidatePool.length,
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
        completedSteps: 5,
        currentStep: "Completed",
        message: `Preprocessed ${normalizedEntries.length} wordbook entries.`
      }
    )
  );

  return {
    cacheFile,
    candidates,
    source: response.source
  };
}

async function selectCandidatesForPreprocess(
  options: BuildSymbolPreprocessOptions,
  candidatePool: PreprocessedSymbolCandidate[],
  sourceHash: string
): Promise<PreprocessedSymbolCandidate[]> {
  if (candidatePool.length === 0) {
    return [];
  }

  options.onProgress?.(
    createProgress("running", candidatePool.length, 0, sourceHash, options.relativeFilePath, {
      completedSteps: 2,
      currentStep: "Selecting wordbook terms",
      message: `Analyzing ${candidatePool.length} candidate symbols for this audience profile.`
    })
  );

  if (options.provider.selectPreprocessCandidates) {
    try {
      const request = buildSelectionRequest(options, candidatePool, sourceHash);
      const response = await options.provider.selectPreprocessCandidates(request, {
        signal: options.signal
      });
      const selectedTermSet = new Set(
        response.selectedTerms.map((term) => term.trim().toLowerCase()).filter(Boolean)
      );
      const selectedCandidates = candidatePool.filter((candidate) =>
        selectedTermSet.has(candidate.normalizedTerm)
      );

      options.logger?.info("Preprocess candidate selection completed", {
        relativeFilePath: options.relativeFilePath,
        providerSource: response.source,
        candidatePoolSize: candidatePool.length,
        selectedCount: selectedCandidates.length,
        note: response.note
      });

      options.onProgress?.(
        createProgress(
          "running",
          selectedCandidates.length,
          0,
          sourceHash,
          options.relativeFilePath,
          {
            completedSteps: 2,
            currentStep: "Selecting wordbook terms",
            message: `Selected ${selectedCandidates.length} wordbook terms from ${candidatePool.length} candidates.`
          }
        )
      );

      return selectedCandidates;
    } catch (error) {
      if (isAbortLikeError(error)) {
        throw error;
      }

      options.logger?.warn("Remote preprocess candidate selection failed, using local fallback", {
        relativeFilePath: options.relativeFilePath,
        candidatePoolSize: candidatePool.length,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const fallbackCandidates = selectPreprocessCandidatesFromPool(
    candidatePool,
    options.settings.professionalLevel,
    options.settings.occupation
  );

  options.onProgress?.(
    createProgress(
      "running",
      fallbackCandidates.length,
      0,
      sourceHash,
      options.relativeFilePath,
      {
        completedSteps: 2,
        currentStep: "Selecting wordbook terms",
        message: `Used local fallback to select ${fallbackCandidates.length} wordbook terms from ${candidatePool.length} candidates.`
      }
    )
  );

  return fallbackCandidates;
}

function buildSelectionRequest(
  options: BuildSymbolPreprocessOptions,
  candidatePool: PreprocessedSymbolCandidate[],
  sourceHash: string
): PreprocessCandidateSelectionRequest {
  return {
    requestId: createContentHash(
      [
        "symbol-preprocess-select",
        options.languageId,
        options.relativeFilePath,
        sourceHash,
        options.settings.professionalLevel,
        options.settings.occupation,
        candidatePool.map((candidate) => candidate.normalizedTerm).join(",")
      ].join(":")
    ),
    languageId: options.languageId,
    filePath: options.filePath,
    relativeFilePath: options.relativeFilePath,
    professionalLevel: options.settings.professionalLevel,
    occupation: options.settings.occupation,
    sourceCode: options.editorText,
    candidatePool,
    userGoal: options.settings.userGoal,
    customInstructions: generatePreprocessAudiencePrompt({
      occupation: options.settings.occupation,
      professionalLevel: options.settings.professionalLevel,
      detailLevel: options.settings.detailLevel,
      userGoal: options.settings.userGoal
    })
  };
}

function normalizePreprocessEntries(
  candidates: PreprocessedSymbolCandidate[],
  entries: PreprocessedSymbolEntry[]
): PreprocessedSymbolEntry[] {
  const entryMap = new Map(entries.map((entry) => [entry.normalizedTerm, entry]));

  return candidates.map((candidate) => {
    const matchedEntry = entryMap.get(candidate.normalizedTerm);

    return (
      matchedEntry ?? {
        term: candidate.term,
        normalizedTerm: candidate.normalizedTerm,
        category: candidate.category,
        sourceLine: candidate.sourceLine,
        summary: `\`${candidate.term}\` 是当前文件中的${toCategoryLabel(
          candidate.category
        )}，作用需要结合附近代码继续确认。`,
        generatedAt: new Date().toISOString()
      }
    );
  });
}

function matchCandidatesToEntries(
  candidatePool: PreprocessedSymbolCandidate[],
  entries: PreprocessedSymbolEntry[]
): PreprocessedSymbolCandidate[] {
  const candidateMap = new Map(
    candidatePool.map((candidate) => [candidate.normalizedTerm, candidate])
  );

  return entries
    .map((entry) => candidateMap.get(entry.normalizedTerm))
    .filter((candidate): candidate is PreprocessedSymbolCandidate => Boolean(candidate));
}

function toCategoryLabel(category: PreprocessedSymbolCandidate["category"]): string {
  switch (category) {
    case "function":
      return "函数";
    case "class":
      return "类";
    case "type":
      return "类型";
    case "label":
      return "标签名";
    default:
      return "变量";
  }
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
    totalSteps: 5,
    completedSteps: status === "completed" ? 5 : 0,
    batchCount: totalCandidates > 0 ? 1 : 0,
    relativeFilePath,
    sourceHash,
    startedAt: new Date().toISOString(),
    ...overrides
  };
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
