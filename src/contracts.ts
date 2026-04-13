export type DetailLevel = "fast" | "balanced" | "deep";
export type ProfessionalLevel = "beginner" | "intermediate" | "expert";
export type ExplanationGranularity =
  | "token"
  | "statement"
  | "block"
  | "function"
  | "file"
  | "workspace";
export type ExplanationReason =
  | "manual"
  | "auto"
  | "fileOverview"
  | "workspaceIndex"
  | "chat";
export type ExplanationSectionName =
  | "summary"
  | "inputOutput"
  | "usage"
  | "syntax"
  | "risk";
export type GlossaryCategory =
  | "variable"
  | "function"
  | "class"
  | "type"
  | "import"
  | "constant"
  | "unknown";

export interface ExtensionSettings {
  autoExplainEnabled: boolean;
  autoExplainDelayMs: number;
  autoOpenPanel: boolean;
  providerId: string;
  providerBaseUrl: string;
  providerModel: string;
  providerApiKeyEnvVar: string;
  providerTimeoutMs: number;
  detailLevel: DetailLevel;
  professionalLevel: ProfessionalLevel;
  sections: ExplanationSectionName[];
  userGoal: string;
  knowledgeTopK: number;
}

export interface GlossaryEntry {
  term: string;
  normalizedTerm: string;
  meaning: string;
  category: GlossaryCategory;
  sourceLine?: number;
  references: number;
  source: "generated" | "user";
  updatedAt: string;
}

export interface GlossaryCacheFile {
  languageId: string;
  relativeFilePath: string;
  sourceHash: string;
  generatedAt: string;
  entries: GlossaryEntry[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  sourcePath: string;
  importedAt: string;
  tags: string[];
  content: string;
}

export interface KnowledgeLibraryFile {
  documents: KnowledgeDocument[];
}

export interface KnowledgeSnippet {
  documentId: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface ExplanationRequest {
  requestId: string;
  reason: ExplanationReason;
  languageId: string;
  filePath: string;
  relativeFilePath: string;
  selectedText: string;
  granularity: ExplanationGranularity;
  detailLevel: DetailLevel;
  professionalLevel: ProfessionalLevel;
  sections: ExplanationSectionName[];
  userGoal: string;
  contextBefore: string;
  contextAfter: string;
  glossaryEntries: GlossaryEntry[];
  knowledgeSnippets: KnowledgeSnippet[];
}

export interface ExplanationSection {
  label: string;
  content: string;
}

export interface ExplanationResponse {
  requestId: string;
  title: string;
  summary: string;
  sections: ExplanationSection[];
  suggestedQuestions: string[];
  glossaryHints: GlossaryEntry[];
  granularity: ExplanationGranularity;
  selectionText: string;
  source: string;
  latencyMs: number;
  note?: string;
  knowledgeUsed: string[];
}

export interface FollowUpRequest {
  explanation: ExplanationResponse;
  request: ExplanationRequest;
  question: string;
  chatHistory: ChatTurn[];
}

export interface FollowUpResponse {
  answer: string;
  suggestedQuestions: string[];
  source: string;
  latencyMs: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface WorkspaceFileSummary {
  path: string;
  languageId: string;
  summary: string;
  tags: string[];
}

export interface WorkspaceIndex {
  generatedAt: string;
  files: WorkspaceFileSummary[];
}
