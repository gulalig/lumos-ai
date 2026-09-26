import type { WorkspaceMemberRole } from '../identity/entities/workspace-member.entity.js';

export interface AccessTokenPayload {
  sub: string;
  workspaceMemberId: string | null;
}

export interface AuthPrincipal {
  userId: string;

  email: string;

  displayName: string;

  workspaceMemberId: string | null;

  workspaceId: string | null;

  role: WorkspaceMemberRole | null;
}
