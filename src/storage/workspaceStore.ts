import { promises as fs } from "fs";
import * as path from "path";
import {
  GlossaryCacheFile,
  KnowledgeLibraryFile,
  WorkspaceIndex
} from "../contracts";
import { slugifyRelativePath } from "../utils/hash";

export class WorkspaceStore {
  constructor(private readonly workspaceRoot: string) {}

  async ensureProjectDataDirectories(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.getProjectDataDirectory(), { recursive: true }),
      fs.mkdir(this.getGlossaryDirectory(), { recursive: true }),
      fs.mkdir(this.getKnowledgeDirectory(), { recursive: true }),
      fs.mkdir(this.getReportDirectory(), { recursive: true })
    ]);
  }

  getProjectDataDirectory(): string {
    return path.join(this.workspaceRoot, ".read-code-in-chinese");
  }

  getGlossaryDirectory(): string {
    return path.join(this.getProjectDataDirectory(), "glossary");
  }

  getKnowledgeDirectory(): string {
    return path.join(this.getProjectDataDirectory(), "knowledge");
  }

  getReportDirectory(): string {
    return path.join(this.getProjectDataDirectory(), "reports");
  }

  getKnowledgeLibraryPath(): string {
    return path.join(this.getKnowledgeDirectory(), "library.json");
  }

  getWorkspaceIndexPath(): string {
    return path.join(this.getProjectDataDirectory(), "workspace-index.json");
  }

  getWorkspaceIndexReportPath(): string {
    return path.join(this.getReportDirectory(), "workspace-index.md");
  }

  getGlossaryCachePath(relativeFilePath: string): string {
    return path.join(
      this.getGlossaryDirectory(),
      `${slugifyRelativePath(relativeFilePath)}.json`
    );
  }

  async readGlossaryCache(relativeFilePath: string): Promise<GlossaryCacheFile | undefined> {
    return this.readJson<GlossaryCacheFile>(this.getGlossaryCachePath(relativeFilePath));
  }

  async writeGlossaryCache(
    relativeFilePath: string,
    glossaryCache: GlossaryCacheFile
  ): Promise<void> {
    await this.writeJson(this.getGlossaryCachePath(relativeFilePath), glossaryCache);
  }

  async readKnowledgeLibrary(): Promise<KnowledgeLibraryFile> {
    return (
      (await this.readJson<KnowledgeLibraryFile>(this.getKnowledgeLibraryPath())) ?? {
        documents: []
      }
    );
  }

  async writeKnowledgeLibrary(library: KnowledgeLibraryFile): Promise<void> {
    await this.writeJson(this.getKnowledgeLibraryPath(), library);
  }

  async writeWorkspaceIndex(index: WorkspaceIndex): Promise<void> {
    await this.writeJson(this.getWorkspaceIndexPath(), index);
  }

  async writeWorkspaceIndexReport(report: string): Promise<void> {
    await fs.mkdir(path.dirname(this.getWorkspaceIndexReportPath()), { recursive: true });
    await fs.writeFile(this.getWorkspaceIndexReportPath(), report, "utf8");
  }

  async readJson<T>(filePath: string): Promise<T | undefined> {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

  async writeJson(filePath: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  }
}
