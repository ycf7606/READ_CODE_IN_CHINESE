import {
  ExplanationRequest,
  ExplanationResponse,
  FollowUpRequest,
  FollowUpResponse,
  PreprocessCandidateSelectionRequest,
  PreprocessCandidateSelectionResponse,
  PromptProfileRequest,
  PromptProfileResponse,
  SymbolPreprocessRequest,
  SymbolPreprocessResponse
} from "../contracts";

export interface ProviderCallOptions {
  signal?: AbortSignal;
}

export interface ExplanationProvider {
  id: string;
  explain(
    request: ExplanationRequest,
    options?: ProviderCallOptions
  ): Promise<ExplanationResponse>;
  answerFollowUp(
    request: FollowUpRequest,
    options?: ProviderCallOptions
  ): Promise<FollowUpResponse>;
  preprocessSymbols?(
    request: SymbolPreprocessRequest,
    options?: ProviderCallOptions
  ): Promise<SymbolPreprocessResponse>;
  selectPreprocessCandidates?(
    request: PreprocessCandidateSelectionRequest,
    options?: ProviderCallOptions
  ): Promise<PreprocessCandidateSelectionResponse>;
  generatePromptProfile?(
    request: PromptProfileRequest,
    options?: ProviderCallOptions
  ): Promise<PromptProfileResponse>;
}
