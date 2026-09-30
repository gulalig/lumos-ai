import type { WorkspaceRole } from "@/types/auth";

export interface CreateWorkspaceRequest {
  name: string;
  industry: string;
  companySize: string;
  website?: string;
}

export interface CompleteWorkflowRequest {
  jobTitle: string;
  teamName: string;
  primaryUseCase: string;
}

export interface CompleteWorkflowResponse {
  status: "completed";
}

export interface OnboardingWorkspace {
  id: string;
  name: string;
  slug: string;
  workspaceMemberId: string;
  role: WorkspaceRole;
}

export interface CreateWorkspaceResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  workspace: OnboardingWorkspace;
}
