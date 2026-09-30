export type WorkspaceRole = "owner" | "admin" | "member";

export interface AuthUser {
  id: string;

  email: string;

  displayName: string | null;
}

export interface AuthWorkspace {
  workspaceId: string;

  workspaceMemberId: string;

  name: string | null;

  role: WorkspaceRole;
}

export interface AuthState {
  accessToken: string | null;

  user: AuthUser | null;

  workspace: AuthWorkspace | null;
}
