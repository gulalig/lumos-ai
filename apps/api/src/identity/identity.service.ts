import { Injectable, NotFoundException } from '@nestjs/common';

import { WorkspaceMembersRepository } from './workspace-members.repository.js';

export interface ResolvedMemberIdentity {
  workspaceMemberId: string;
  workspaceId: string;
  userId: string;

  displayName: string;
  email: string;

  role: 'owner' | 'admin' | 'member';

  jobTitle: string | null;
  teamName: string | null;

  livekitIdentity: string;
}

@Injectable()
export class IdentityService {
  constructor(private readonly workspaceMembers: WorkspaceMembersRepository) {}

  async resolveMember(
    workspaceMemberId: string,
  ): Promise<ResolvedMemberIdentity> {
    const member = await this.workspaceMembers.findById(workspaceMemberId);

    if (!member) {
      throw new NotFoundException(
        `Workspace member ${workspaceMemberId} was not found`,
      );
    }

    return {
      workspaceMemberId: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,

      displayName: member.user.displayName,

      email: member.user.email,

      role: member.role,

      jobTitle: member.jobTitle,

      teamName: member.teamName,

      livekitIdentity: `member:${member.id}`,
    };
  }
}
