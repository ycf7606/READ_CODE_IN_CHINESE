import {
  PreprocessedSymbolCacheFile,
  PreprocessedSymbolEntry
} from "../contracts";
import { WorkspaceStore } from "../storage/workspaceStore";

export const PREPROCESS_CACHE_BUILDER_VERSION = 2;

export class PreprocessStore {
  constructor(private readonly workspaceStore: WorkspaceStore) {}

  async read(relativeFilePath: string): Promise<PreprocessedSymbolCacheFile | undefined> {
    return this.workspaceStore.readPreprocessCache(relativeFilePath);
  }

  async write(
    relativeFilePath: string,
    cacheFile: PreprocessedSymbolCacheFile
  ): Promise<void> {
    await this.workspaceStore.writePreprocessCache(relativeFilePath, cacheFile);
  }

  async findEntry(
    relativeFilePath: string,
    sourceHash: string,
    term: string
  ): Promise<PreprocessedSymbolEntry | undefined> {
    const cacheFile = await this.read(relativeFilePath);

    if (!this.isCurrent(cacheFile, sourceHash)) {
      return undefined;
    }

    return cacheFile.entries.find((entry) => entry.normalizedTerm === term.trim().toLowerCase());
  }

  isCurrent(
    cacheFile: PreprocessedSymbolCacheFile | undefined,
    sourceHash?: string
  ): cacheFile is PreprocessedSymbolCacheFile {
    if (!cacheFile) {
      return false;
    }

    if (cacheFile.builderVersion !== PREPROCESS_CACHE_BUILDER_VERSION) {
      return false;
    }

    if (sourceHash && cacheFile.sourceHash !== sourceHash) {
      return false;
    }

    return true;
  }
}
