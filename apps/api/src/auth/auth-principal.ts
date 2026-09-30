import type { WorkspaceMemberRole } from '../identity/entities/workspace-member.entity.js';

export interface AccessTokenPayload {
  sub: string;

  workspaceMemberId: string | null;
}

export interface AuthPrincipal {
  userId: string;

  email: string;

  displayName: string | null;

  workspaceMemberId: string | null;

  workspaceId: string | null;

  workspaceName: string | null;

  role: WorkspaceMemberRole | null;
}
