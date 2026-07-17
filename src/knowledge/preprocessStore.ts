import {
  PreprocessedSymbolCacheFile,
  PreprocessedSymbolEntry
} from "../contracts";
import { WorkspaceStore } from "../storage/workspaceStore";
import { isPreprocessCacheCompatible } from "./preprocessFingerprint";

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
    term: string,
    expectedFingerprint?: string
  ): Promise<PreprocessedSymbolEntry | undefined> {
    const cacheFile = await this.read(relativeFilePath);

    if (
      !cacheFile ||
      cacheFile.sourceHash !== sourceHash ||
      (expectedFingerprint && !isPreprocessCacheCompatible(cacheFile, expectedFingerprint))
    ) {
      return undefined;
    }

    return cacheFile.entries.find((entry) => entry.normalizedTerm === term.trim().toLowerCase());
  }
}
