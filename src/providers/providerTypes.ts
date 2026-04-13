import {
  ExplanationRequest,
  ExplanationResponse,
  FollowUpRequest,
  FollowUpResponse
} from "../contracts";

export interface ExplanationProvider {
  id: string;
  explain(request: ExplanationRequest): Promise<ExplanationResponse>;
  answerFollowUp(request: FollowUpRequest): Promise<FollowUpResponse>;
}
