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
import { buildPreprocessCandidates } from "../analysis/preprocess";
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
  candidates?: PreprocessedSymbolCandidate[];
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
  const existingCache = await preprocessStore.read(options.relativeFilePath);
  const candidates =
    options.candidates ??
    buildPreprocessCandidates(
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
          completedSteps: 4,
          currentStep: "Completed",
          message: `Selected ${candidates.length} wordbook terms and loaded ${existingCache.entries.length} cached entries.`
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
        completedSteps: 4,
        currentStep: "Completed",
        message: "No file-local symbols need preprocessing for the current audience."
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
      completedSteps: 2,
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

  const entryMap = new Map(response.entries.map((entry) => [entry.normalizedTerm, entry]));
  const normalizedEntries = candidates.map((candidate) => {
    const existingEntry = entryMap.get(candidate.normalizedTerm);

    return (
      existingEntry ?? {
        term: candidate.term,
        normalizedTerm: candidate.normalizedTerm,
        category: candidate.category,
        sourceLine: candidate.sourceLine,
        summary: `\`${candidate.term}\` 是当前文件中的${toCategoryLabel(
          candidate.category
        )}，作用要结合附近逻辑继续确认。`,
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
        completedSteps: 3,
        currentStep: "Saving cache",
        message: `Saving ${normalizedEntries.length} wordbook entries.`
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
        completedSteps: 4,
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
    totalSteps: 4,
    completedSteps: status === "completed" ? 4 : 0,
    batchCount: totalCandidates > 0 ? 1 : 0,
    relativeFilePath,
    sourceHash,
    startedAt: new Date().toISOString(),
    ...overrides
  };
}
