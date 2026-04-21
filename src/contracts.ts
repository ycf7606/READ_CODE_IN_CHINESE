export type DetailLevel = "fast" | "balanced" | "deep";
export type ProfessionalLevel = "beginner" | "intermediate" | "expert";
export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";
export type ProviderId = "local" | "openai-compatible";
export type PreprocessSelectionMode = "all-candidates" | "audience-filtered";
export type Occupation =
  | "student"
  | "developer"
  | "data-scientist"
  | "researcher"
  | "maintainer";
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
  | "chat"
  | "prebuild";
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
  | "label"
  | "import"
  | "constant"
  | "unknown";
export type PreprocessedSymbolCategory =
  | "variable"
  | "function"
  | "class"
  | "type"
  | "label";
export type PreprocessCandidateStatus = "pending" | "processing" | "succeeded" | "failed";
export type PreprocessStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

export interface ProviderFallback {
  baseUrl: string;
  model: string;
  apiKeyEnvVar: string;
}

export interface ExtensionSettings {
  autoExplainEnabled: boolean;
  autoExplainDelayMs: number;
  autoOpenPanel: boolean;
  providerId: ProviderId;
  providerBaseUrl: string;
  providerModel: string;
  providerApiKeyEnvVar: string;
  providerFallbacks: ProviderFallback[];
  providerTimeoutMs: number;
  providerTemperature: number;
  providerTopP: number;
  providerMaxTokens: number;
  providerReasoningEffort: ReasoningEffort;
  detailLevel: DetailLevel;
  professionalLevel: ProfessionalLevel;
  occupation: Occupation;
  sections: ExplanationSectionName[];
  userGoal: string;
  knowledgeTopK: number;
  customInstructions: string;
  preprocessIncludeAllCandidates: boolean;
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
  sourceType?: "imported" | "official-doc";
  languageId?: string;
  canonicalUrl?: string;
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
  selectionPreview: string;
  granularity: ExplanationGranularity;
  detailLevel: DetailLevel;
  occupation: Occupation;
  professionalLevel: ProfessionalLevel;
  sections: ExplanationSectionName[];
  userGoal: string;
  customInstructions: string;
  contextBefore: string;
  contextAfter: string;
  glossaryEntries: GlossaryEntry[];
  knowledgeSnippets: KnowledgeSnippet[];
}

export interface ExplanationSection {
  label: string;
  content: string;
  items?: string[];
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

export interface TokenKnowledgeEntry {
  languageId: string;
  term: string;
  normalizedTerm: string;
  generatedAt: string;
  updatedAt: string;
  explanation: ExplanationResponse;
}

export interface TokenKnowledgeFile {
  languageId: string;
  entries: TokenKnowledgeEntry[];
}

export interface PreprocessedSymbolCandidate {
  term: string;
  normalizedTerm: string;
  category: PreprocessedSymbolCategory;
  sourceLine: number;
  references: number;
  score: number;
}

export interface PreprocessedSymbolEntry {
  term: string;
  normalizedTerm: string;
  category: PreprocessedSymbolCategory;
  sourceLine: number;
  summary: string;
  generatedAt: string;
  isPlaceholder?: boolean;
  scopePath?: string[];
}

export interface PreprocessCandidateState {
  term: string;
  normalizedTerm: string;
  category: PreprocessedSymbolCategory;
  sourceLine: number;
  references: number;
  status: PreprocessCandidateStatus;
  summary?: string;
  error?: string;
  generatedAt?: string;
  scopePath?: string[];
}

export interface PreprocessedSymbolCacheFile {
  languageId: string;
  relativeFilePath: string;
  sourceHash: string;
  generatedAt: string;
  entries: PreprocessedSymbolEntry[];
  candidateStates?: PreprocessCandidateState[];
  candidatePoolCount?: number;
  selectedCandidateCount?: number;
  selectionMode?: PreprocessSelectionMode;
  selectionSource?: string;
  inferenceSource?: string;
  verifiedRemoteInference?: boolean;
}

export interface SymbolPreprocessRequest {
  requestId: string;
  languageId: string;
  filePath: string;
  relativeFilePath: string;
  professionalLevel: ProfessionalLevel;
  occupation: Occupation;
  sourceCode: string;
  candidates: PreprocessedSymbolCandidate[];
  userGoal: string;
  customInstructions: string;
}

export interface SymbolPreprocessResponse {
  requestId: string;
  languageId: string;
  entries: PreprocessedSymbolEntry[];
  source: string;
  latencyMs: number;
}

export interface PreprocessCandidateSelectionRequest {
  requestId: string;
  languageId: string;
  filePath: string;
  relativeFilePath: string;
  professionalLevel: ProfessionalLevel;
  occupation: Occupation;
  sourceCode: string;
  candidatePool: PreprocessedSymbolCandidate[];
  targetSelectionCount: number;
  retentionRatio: number;
  userGoal: string;
  customInstructions: string;
}

export interface PreprocessCandidateSelectionResponse {
  requestId: string;
  languageId: string;
  selectedTerms: string[];
  source: string;
  latencyMs: number;
  note?: string;
}

export interface PromptProfileRequest {
  occupation: Occupation;
  professionalLevel: ProfessionalLevel;
  detailLevel: DetailLevel;
  sections: ExplanationSectionName[];
  userGoal: string;
  reasoningEffort: ReasoningEffort;
  temperature: number;
  topP: number;
  maxTokens: number;
}

export interface PromptProfileResponse {
  prompt: string;
  source: string;
  latencyMs: number;
  note?: string;
}

export interface PreprocessProgress {
  status: PreprocessStatus;
  totalCandidates: number;
  processedCandidates: number;
  totalSteps: number;
  completedSteps: number;
  batchCount: number;
  processedBatches?: number;
  candidatePoolCount?: number;
  relativeFilePath?: string;
  currentStep?: string;
  message?: string;
  sourceHash?: string;
  startedAt?: string;
  completedAt?: string;
  selectionMode?: PreprocessSelectionMode;
  selectionSource?: string;
  providerSource?: string;
  verifiedRemoteInference?: boolean;
  candidateStates?: PreprocessCandidateState[];
  successfulCandidates?: number;
  failedCandidates?: number;
}
