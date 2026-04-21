import {
  ExplanationRequest,
  ExplanationResponse,
  ExtensionSettings,
  GlossaryEntry,
  PreprocessSelectionMode,
  PreprocessCandidateSelectionRequest,
  PreprocessedSymbolCacheFile,
  PreprocessedSymbolCandidate,
  PreprocessedSymbolEntry,
  PreprocessProgress,
  SymbolPreprocessRequest
} from "../contracts";
import {
  buildPreprocessCandidatePool,
  getPreprocessRetentionRatio,
  getPreprocessTargetSelectionCount,
  rankPreprocessCandidatesForAudience,
  selectPreprocessCandidatesFromPool
} from "../analysis/preprocess";
import { ExtensionLogger } from "../logging/logger";
import { generatePreprocessAudiencePrompt } from "../prompts/globalPromptProfile";
import { ExplanationProvider } from "../providers/providerTypes";
import { WorkspaceStore } from "../storage/workspaceStore";
import { createContentHash } from "../utils/hash";
import { PreprocessStore } from "./preprocessStore";

const PREPROCESS_CHUNK_SIZE = 20;

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
  onCacheUpdate?: (cacheFile: PreprocessedSymbolCacheFile) => void;
  getPriorityScore?: (sourceLine: number) => number;
}

export interface SymbolPreprocessResult {
  cacheFile: PreprocessedSymbolCacheFile;
  candidates: PreprocessedSymbolCandidate[];
  source: string;
  selectionMode: PreprocessSelectionMode;
  selectionSource: string;
  verifiedRemoteInference: boolean;
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
    createProgress(candidatePool.length, 0, 0, sourceHash, options.relativeFilePath, {
      status: "running",
      completedSteps: 1,
      currentStep: "Preparing candidate pool",
      message: `Prepared ${candidatePool.length} preprocessable symbols for this file.`
    })
  );

  const selectionMode: PreprocessSelectionMode = options.settings.preprocessIncludeAllCandidates
    ? "all-candidates"
    : "audience-filtered";
  const selection = options.settings.preprocessIncludeAllCandidates
    ? selectAllCandidatesForPreprocess(options, candidatePool, sourceHash)
    : await selectCandidatesForPreprocess(options, candidatePool, sourceHash);
  const selectedCandidates = selection.candidates;
  const existingCache = await preprocessStore.read(options.relativeFilePath);
  const selectedCandidateTerms = new Set(
    selectedCandidates.map((candidate) => candidate.normalizedTerm)
  );
  const cachedEntries =
    existingCache && existingCache.sourceHash === sourceHash
      ? existingCache.entries.filter(
          (entry) =>
            selectedCandidateTerms.has(entry.normalizedTerm) &&
            !isPlaceholderPreprocessEntry(entry)
        )
      : [];
  const missingCandidates = selectedCandidates.filter(
    (candidate) => !cachedEntries.some((entry) => entry.normalizedTerm === candidate.normalizedTerm)
  );

  if (selectedCandidates.length === 0) {
    const emptyCache: PreprocessedSymbolCacheFile = {
      languageId: options.languageId,
      relativeFilePath: options.relativeFilePath,
      sourceHash,
      generatedAt: new Date().toISOString(),
      entries: [],
      candidatePoolCount: candidatePool.length,
      selectedCandidateCount: 0,
      selectionMode,
      selectionSource: selection.source,
      inferenceSource: "none",
      verifiedRemoteInference: false
    };
    await preprocessStore.write(options.relativeFilePath, emptyCache);
    options.onCacheUpdate?.(emptyCache);
    options.onProgress?.(
      createProgress(candidatePool.length, 0, 0, sourceHash, options.relativeFilePath, {
        status: "completed",
        completedSteps: 5,
        currentStep: "Completed",
        message:
          selectionMode === "all-candidates"
            ? "No preprocessable file-local symbols were found."
            : "No file-local symbols were selected for the current audience profile.",
        selectionMode,
        selectionSource: selection.source,
        providerSource: "none",
        verifiedRemoteInference: false
      })
    );

    return {
      cacheFile: emptyCache,
      candidates: [],
      source: "empty",
      selectionMode,
      selectionSource: selection.source,
      verifiedRemoteInference: false
    };
  }

  if (missingCandidates.length === 0) {
    const normalizedCache = buildCacheFile(
      options,
      sourceHash,
      sortPreprocessEntries(cachedEntries, selectedCandidates),
      {
        candidatePoolCount: candidatePool.length,
        selectedCandidateCount: selectedCandidates.length,
        selectionMode,
        selectionSource: selection.source,
        inferenceSource: existingCache?.inferenceSource ?? "cache",
        verifiedRemoteInference:
          existingCache?.verifiedRemoteInference ??
          (existingCache?.inferenceSource === "openai-compatible")
      }
    );

    if (
      !existingCache ||
      existingCache.sourceHash !== sourceHash ||
      existingCache.entries.length !== normalizedCache.entries.length ||
      existingCache.selectionMode !== normalizedCache.selectionMode ||
      existingCache.selectionSource !== normalizedCache.selectionSource ||
      existingCache.inferenceSource !== normalizedCache.inferenceSource ||
      existingCache.verifiedRemoteInference !== normalizedCache.verifiedRemoteInference
    ) {
      await preprocessStore.write(options.relativeFilePath, normalizedCache);
      options.onCacheUpdate?.(normalizedCache);
    }

    options.onProgress?.(
      createProgress(
        candidatePool.length,
        selectedCandidates.length,
        normalizedCache.entries.length,
        sourceHash,
        options.relativeFilePath,
        {
          status: "completed",
          completedSteps: 5,
          batchCount: Math.max(1, Math.ceil(selectedCandidates.length / PREPROCESS_CHUNK_SIZE)),
          processedBatches: Math.max(1, Math.ceil(selectedCandidates.length / PREPROCESS_CHUNK_SIZE)),
          currentStep: "Completed",
          message: `Loaded ${normalizedCache.entries.length} cached wordbook entries.`,
          selectionMode,
          selectionSource: selection.source,
          providerSource: normalizedCache.inferenceSource ?? "cache",
          verifiedRemoteInference: normalizedCache.verifiedRemoteInference ?? false
        }
      )
    );

    return {
      cacheFile: normalizedCache,
      candidates: selectedCandidates,
      source: "cache",
      selectionMode,
      selectionSource: selection.source,
      verifiedRemoteInference: normalizedCache.verifiedRemoteInference ?? false
    };
  }

  const totalBatchCount = Math.max(1, Math.ceil(missingCandidates.length / PREPROCESS_CHUNK_SIZE));
  const mergedEntries = new Map(cachedEntries.map((entry) => [entry.normalizedTerm, entry]));
  let remainingCandidates = [...missingCandidates];
  let processedBatches = 0;
  let responseSource = options.provider.id;
  let verifiedRemoteInference = false;

  while (remainingCandidates.length > 0) {
    const nextChunk = takeNextPreprocessChunk(
      remainingCandidates,
      options.getPriorityScore,
      selectedCandidates
    );

    options.onProgress?.(
      createProgress(
        candidatePool.length,
        selectedCandidates.length,
        mergedEntries.size,
        sourceHash,
        options.relativeFilePath,
        {
          status: "running",
          completedSteps: 3,
          batchCount: totalBatchCount,
          processedBatches,
          currentStep: "Preprocessing wordbook chunk",
          message: `Processing batch ${processedBatches + 1} / ${totalBatchCount} with ${nextChunk.length} terms.`,
          selectionMode,
          selectionSource: selection.source,
          providerSource: responseSource
        }
      )
    );

    const response = await options.provider.preprocessSymbols(
      buildChunkRequest(options, nextChunk, sourceHash),
      {
        signal: options.signal
      }
    );
    responseSource = response.source;

    if (response.source !== "openai-compatible") {
      throw new Error(
        `Preprocess inference was expected to use the remote API, but the provider reported source=${response.source}.`
      );
    }

    const normalizedChunkEntries = normalizePreprocessEntries(nextChunk, response.entries);
    assertCompleteChunkResponse(nextChunk, normalizedChunkEntries);
    verifiedRemoteInference = true;

    for (const entry of normalizedChunkEntries) {
      mergedEntries.set(entry.normalizedTerm, entry);
    }

    remainingCandidates = remainingCandidates.filter(
      (candidate) => !nextChunk.some((chunkEntry) => chunkEntry.normalizedTerm === candidate.normalizedTerm)
    );
    processedBatches += 1;

    const partialCache = buildCacheFile(
      options,
      sourceHash,
      sortPreprocessEntries(Array.from(mergedEntries.values()), selectedCandidates),
      {
        candidatePoolCount: candidatePool.length,
        selectedCandidateCount: selectedCandidates.length,
        selectionMode,
        selectionSource: selection.source,
        inferenceSource: responseSource,
        verifiedRemoteInference
      }
    );
    await preprocessStore.write(options.relativeFilePath, partialCache);
    options.onCacheUpdate?.(partialCache);
    options.onProgress?.(
      createProgress(
        candidatePool.length,
        selectedCandidates.length,
        partialCache.entries.length,
        sourceHash,
        options.relativeFilePath,
        {
          status: "running",
          completedSteps: 3,
          batchCount: totalBatchCount,
          processedBatches,
          currentStep: "Preprocessing wordbook chunk",
          message: `Completed batch ${processedBatches} / ${totalBatchCount}. Cached ${partialCache.entries.length} entries.`,
          selectionMode,
          selectionSource: selection.source,
          providerSource: responseSource,
          verifiedRemoteInference
        }
      )
    );
  }

  const cacheFile = buildCacheFile(
    options,
    sourceHash,
    sortPreprocessEntries(
      normalizePreprocessEntries(selectedCandidates, Array.from(mergedEntries.values())),
      selectedCandidates
    ),
    {
      candidatePoolCount: candidatePool.length,
      selectedCandidateCount: selectedCandidates.length,
      selectionMode,
      selectionSource: selection.source,
      inferenceSource: responseSource,
      verifiedRemoteInference
    }
  );

  options.onProgress?.(
    createProgress(
      candidatePool.length,
      selectedCandidates.length,
      cacheFile.entries.length,
      sourceHash,
      options.relativeFilePath,
      {
        status: "running",
        completedSteps: 4,
        batchCount: totalBatchCount,
        processedBatches,
        currentStep: "Finalizing cache",
        message: `Finalizing ${cacheFile.entries.length} wordbook entries.`,
        selectionMode,
        selectionSource: selection.source,
        providerSource: responseSource,
        verifiedRemoteInference
      }
    )
  );

  await preprocessStore.write(options.relativeFilePath, cacheFile);
  options.onCacheUpdate?.(cacheFile);
  options.logger?.info("Symbol preprocessing completed", {
    relativeFilePath: options.relativeFilePath,
    languageId: options.languageId,
    candidatePoolSize: candidatePool.length,
    selectedCount: selectedCandidates.length,
    batchCount: totalBatchCount,
    symbolCount: cacheFile.entries.length,
    selectionMode,
    selectionSource: selection.source,
    source: responseSource,
    verifiedRemoteInference
  });

  options.onProgress?.(
    createProgress(
      candidatePool.length,
      selectedCandidates.length,
      cacheFile.entries.length,
      sourceHash,
      options.relativeFilePath,
      {
        status: "completed",
        completedSteps: 5,
        batchCount: totalBatchCount,
        processedBatches,
        currentStep: "Completed",
        message: `Preprocessed ${cacheFile.entries.length} wordbook entries in ${totalBatchCount} batches.`,
        selectionMode,
        selectionSource: selection.source,
        providerSource: responseSource,
        verifiedRemoteInference
      }
    )
  );

  return {
    cacheFile,
    candidates: selectedCandidates,
    source: responseSource,
    selectionMode,
    selectionSource: selection.source,
    verifiedRemoteInference
  };
}

async function selectCandidatesForPreprocess(
  options: BuildSymbolPreprocessOptions,
  candidatePool: PreprocessedSymbolCandidate[],
  sourceHash: string
): Promise<{
  candidates: PreprocessedSymbolCandidate[];
  source: string;
}> {
  if (candidatePool.length === 0) {
    return {
      candidates: [],
      source: "empty"
    };
  }

  const rankedCandidates = rankPreprocessCandidatesForAudience(
    candidatePool,
    options.settings.professionalLevel,
    options.settings.occupation
  );
  const targetSelectionCount = getPreprocessTargetSelectionCount(
    candidatePool.length,
    options.settings.professionalLevel
  );

  options.onProgress?.(
    createProgress(candidatePool.length, targetSelectionCount, 0, sourceHash, options.relativeFilePath, {
      status: "running",
      completedSteps: 2,
      batchCount: 0,
      processedBatches: 0,
      currentStep: "Selecting wordbook terms",
      message: `Selecting ${targetSelectionCount} wordbook terms from ${candidatePool.length} candidates.`,
      selectionMode: "audience-filtered",
      selectionSource: "pending-remote-selection",
      providerSource: options.provider.id
    })
  );

  if (options.provider.selectPreprocessCandidates) {
    try {
      const request = buildSelectionRequest(
        options,
        candidatePool,
        sourceHash,
        targetSelectionCount
      );
      const response = await options.provider.selectPreprocessCandidates(request, {
        signal: options.signal
      });
      const selectedTermSet = new Set(
        response.selectedTerms.map((term) => term.trim().toLowerCase()).filter(Boolean)
      );
      const remoteSelectedCandidates = candidatePool.filter((candidate) =>
        selectedTermSet.has(candidate.normalizedTerm)
      );
      const selectedCandidates = reconcileSelectedCandidates(
        rankedCandidates,
        remoteSelectedCandidates,
        targetSelectionCount
      );

      options.logger?.info("Preprocess candidate selection completed", {
        relativeFilePath: options.relativeFilePath,
        providerSource: response.source,
        candidatePoolSize: candidatePool.length,
        targetSelectionCount,
        remoteSelectedCount: remoteSelectedCandidates.length,
        finalSelectedCount: selectedCandidates.length,
        note: response.note
      });

      options.onProgress?.(
        createProgress(
          candidatePool.length,
          selectedCandidates.length,
          0,
          sourceHash,
          options.relativeFilePath,
          {
            status: "running",
            completedSteps: 2,
            batchCount: 0,
            processedBatches: 0,
            currentStep: "Selecting wordbook terms",
            message: `Selected ${selectedCandidates.length} wordbook terms from ${candidatePool.length} candidates.`,
            selectionMode: "audience-filtered",
            selectionSource: response.source,
            providerSource: response.source
          }
        )
      );

      return {
        candidates: selectedCandidates,
        source: response.source
      };
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
      candidatePool.length,
      fallbackCandidates.length,
      0,
      sourceHash,
      options.relativeFilePath,
      {
        status: "running",
        completedSteps: 2,
        batchCount: 0,
        processedBatches: 0,
        currentStep: "Selecting wordbook terms",
        message: `Used local fallback to select ${fallbackCandidates.length} wordbook terms from ${candidatePool.length} candidates.`,
        selectionMode: "audience-filtered",
        selectionSource: "local-fallback",
        providerSource: options.provider.id
      }
    )
  );

  return {
    candidates: fallbackCandidates,
    source: "local-fallback"
  };
}

function selectAllCandidatesForPreprocess(
  options: BuildSymbolPreprocessOptions,
  candidatePool: PreprocessedSymbolCandidate[],
  sourceHash: string
): {
  candidates: PreprocessedSymbolCandidate[];
  source: string;
} {
  options.onProgress?.(
    createProgress(candidatePool.length, candidatePool.length, 0, sourceHash, options.relativeFilePath, {
      status: "running",
      completedSteps: 2,
      batchCount: 0,
      processedBatches: 0,
      currentStep: "Selecting wordbook terms",
      message: `Configured to preprocess all ${candidatePool.length} file-local symbols.`,
      selectionMode: "all-candidates",
      selectionSource: "all-candidates",
      providerSource: options.provider.id
    })
  );

  return {
    candidates: candidatePool,
    source: "all-candidates"
  };
}

function buildSelectionRequest(
  options: BuildSymbolPreprocessOptions,
  candidatePool: PreprocessedSymbolCandidate[],
  sourceHash: string,
  targetSelectionCount: number
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
        targetSelectionCount,
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
    targetSelectionCount,
    retentionRatio: getPreprocessRetentionRatio(options.settings.professionalLevel),
    userGoal: options.settings.userGoal,
    customInstructions: generatePreprocessAudiencePrompt({
      occupation: options.settings.occupation,
      professionalLevel: options.settings.professionalLevel,
      detailLevel: "fast",
      userGoal: options.settings.userGoal
    })
  };
}

function buildChunkRequest(
  options: BuildSymbolPreprocessOptions,
  candidates: PreprocessedSymbolCandidate[],
  sourceHash: string
): SymbolPreprocessRequest {
  return {
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
      detailLevel: "fast",
      userGoal: options.settings.userGoal
    })
  };
}

function reconcileSelectedCandidates(
  rankedCandidates: PreprocessedSymbolCandidate[],
  remoteSelectedCandidates: PreprocessedSymbolCandidate[],
  targetSelectionCount: number
): PreprocessedSymbolCandidate[] {
  const remoteSelectedTermSet = new Set(
    remoteSelectedCandidates.map((candidate) => candidate.normalizedTerm)
  );
  const selectedCandidates = rankedCandidates.filter((candidate) =>
    remoteSelectedTermSet.has(candidate.normalizedTerm)
  );

  if (selectedCandidates.length >= targetSelectionCount) {
    return selectedCandidates.slice(0, targetSelectionCount);
  }

  const missingCandidates = rankedCandidates.filter(
    (candidate) => !remoteSelectedTermSet.has(candidate.normalizedTerm)
  );

  return [...selectedCandidates, ...missingCandidates].slice(0, targetSelectionCount);
}

function takeNextPreprocessChunk(
  remainingCandidates: PreprocessedSymbolCandidate[],
  getPriorityScore: BuildSymbolPreprocessOptions["getPriorityScore"],
  selectedCandidates: PreprocessedSymbolCandidate[]
): PreprocessedSymbolCandidate[] {
  const orderMap = new Map(
    selectedCandidates.map((candidate, index) => [candidate.normalizedTerm, index])
  );

  return [...remainingCandidates]
    .sort((left, right) => {
      const priorityDifference =
        (getPriorityScore?.(right.sourceLine) ?? 0) - (getPriorityScore?.(left.sourceLine) ?? 0);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        (orderMap.get(left.normalizedTerm) ?? Number.MAX_SAFE_INTEGER) -
        (orderMap.get(right.normalizedTerm) ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, PREPROCESS_CHUNK_SIZE);
}

function buildCacheFile(
  options: BuildSymbolPreprocessOptions,
  sourceHash: string,
  entries: PreprocessedSymbolEntry[],
  metadata?: Pick<
    PreprocessedSymbolCacheFile,
    | "candidatePoolCount"
    | "selectedCandidateCount"
    | "selectionMode"
    | "selectionSource"
    | "inferenceSource"
    | "verifiedRemoteInference"
  >
): PreprocessedSymbolCacheFile {
  return {
    languageId: options.languageId,
    relativeFilePath: options.relativeFilePath,
    sourceHash,
    generatedAt: new Date().toISOString(),
    entries,
    ...metadata
  };
}

function normalizePreprocessEntries(
  candidates: PreprocessedSymbolCandidate[],
  entries: PreprocessedSymbolEntry[]
): PreprocessedSymbolEntry[] {
  const entryMap = new Map(entries.map((entry) => [entry.normalizedTerm, entry]));
  const normalizedEntries: PreprocessedSymbolEntry[] = [];

  for (const candidate of candidates) {
    const matchedEntry = entryMap.get(candidate.normalizedTerm);

    if (!matchedEntry) {
      continue;
    }

    normalizedEntries.push({
      ...matchedEntry,
      isPlaceholder: false
    });
  }

  return normalizedEntries;
}

function sortPreprocessEntries(
  entries: PreprocessedSymbolEntry[],
  candidates: PreprocessedSymbolCandidate[]
): PreprocessedSymbolEntry[] {
  const orderMap = new Map(
    candidates.map((candidate, index) => [candidate.normalizedTerm, index])
  );

  return [...entries].sort((left, right) => {
    return (
      (orderMap.get(left.normalizedTerm) ?? Number.MAX_SAFE_INTEGER) -
      (orderMap.get(right.normalizedTerm) ?? Number.MAX_SAFE_INTEGER)
    );
  });
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
  candidatePoolCount: number,
  totalCandidates: number,
  processedCandidates: number,
  sourceHash: string,
  relativeFilePath: string,
  overrides?: Partial<PreprocessProgress>
): PreprocessProgress {
  return {
    status: "running",
    totalCandidates,
    processedCandidates,
    totalSteps: 5,
    completedSteps: 0,
    batchCount: totalCandidates > 0 ? Math.max(1, Math.ceil(totalCandidates / PREPROCESS_CHUNK_SIZE)) : 0,
    processedBatches: 0,
    candidatePoolCount,
    relativeFilePath,
    sourceHash,
    startedAt: new Date().toISOString(),
    ...overrides
  };
}

function assertCompleteChunkResponse(
  requestedCandidates: PreprocessedSymbolCandidate[],
  normalizedEntries: PreprocessedSymbolEntry[]
): void {
  const returnedTerms = new Set(
    normalizedEntries.map((entry) => entry.normalizedTerm)
  );
  const missingTerms = requestedCandidates
    .filter((candidate) => !returnedTerms.has(candidate.normalizedTerm))
    .map((candidate) => candidate.term);

  if (missingTerms.length > 0) {
    throw new Error(
      `Remote preprocess response was incomplete. Missing ${missingTerms.length} terms: ${missingTerms
        .slice(0, 8)
        .join(", ")}`
    );
  }
}

function isPlaceholderPreprocessEntry(entry: PreprocessedSymbolEntry): boolean {
  return (
    entry.isPlaceholder === true ||
    /作用需要结合附近代码继续确认/.test(entry.summary)
  );
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
