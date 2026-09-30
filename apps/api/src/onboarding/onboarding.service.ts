import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { AccessTokenService } from '../auth/access-token.service.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';

import { UsersRepository } from '../identity/users.repository.js';
import { WorkspaceMembersRepository } from '../identity/workspace-members.repository.js';
import { WorkspacesRepository } from '../identity/workspaces.repository.js';

export interface CompleteWorkspaceOnboardingInput {
  userId: string;
  refreshToken: string;
  workspaceName: string;
  industry: string;
  companySize: string;
  website: string | null;
}

export interface CompleteWorkflowOnboardingInput {
  workspaceId: string;
  workspaceMemberId: string;
  jobTitle: string;
  teamName: string;
  primaryUseCase: string;
}

@Injectable()
export class OnboardingService {
  public constructor(
    private readonly dataSource: DataSource,

    private readonly users: UsersRepository,

    private readonly workspaces: WorkspacesRepository,

    private readonly workspaceMembers: WorkspaceMembersRepository,

    private readonly accessTokens: AccessTokenService,

    private readonly refreshTokens: RefreshTokenService,
  ) {}

  public async createWorkspace(input: CompleteWorkspaceOnboardingInput) {
    const name = input.workspaceName.trim();

    if (!name) {
      throw new ConflictException('Workspace name is required');
    }

    if (name.length > 120) {
      throw new ConflictException(
        'Workspace name must be 120 characters or fewer',
      );
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const user = await this.users.findByIdForUpdate(input.userId, manager);

      if (!user || !user.emailVerifiedAt) {
        throw new UnauthorizedException();
      }

      const existingMembership = await this.workspaceMembers.findFirstByUserId(
        user.id,
        manager,
      );

      if (existingMembership) {
        throw new ConflictException(
          'Workspace onboarding has already been completed',
        );
      }

      const workspaceId = randomUUID();

      const memberId = randomUUID();

      const workspace = await this.workspaces.create(
        {
          id: workspaceId,

          name,

          slug: this.createSlug(name, workspaceId),

          industry: input.industry.trim(),

          companySize: input.companySize.trim(),

          website: input.website?.trim() || null,
        },
        manager,
      );

      const membership = await this.workspaceMembers.create(
        {
          id: memberId,

          workspaceId: workspace.id,

          userId: user.id,

          role: 'owner',
        },
        manager,
      );

      const refresh = await this.refreshTokens.transitionToWorkspace(
        {
          refreshToken: input.refreshToken,

          userId: user.id,

          workspaceMemberId: membership.id,
        },
        manager,
      );

      return {
        user,
        workspace,
        membership,
        refresh,
      };
    });

    const access = await this.accessTokens.create({
      userId: result.user.id,

      workspaceMemberId: result.membership.id,
    });

    return {
      accessToken: access.accessToken,

      tokenType: 'Bearer' as const,

      expiresInSeconds: access.expiresInSeconds,

      refreshToken: result.refresh.refreshToken,

      refreshTokenExpiresAt: result.refresh.expiresAt,

      workspace: {
        id: result.workspace.id,

        name: result.workspace.name,

        slug: result.workspace.slug,

        workspaceMemberId: result.membership.id,

        role: result.membership.role,
      },
    };
  }

  public async completeWorkflow(input: CompleteWorkflowOnboardingInput) {
    const jobTitle = input.jobTitle.trim();

    const teamName = input.teamName.trim();

    const primaryUseCase = input.primaryUseCase.trim();

    if (!jobTitle || !teamName || !primaryUseCase) {
      throw new ConflictException(
        'Job title, team and primary use case are required',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await this.workspaceMembers.updateProfile(
        input.workspaceMemberId,
        {
          jobTitle,

          teamName,
        },
        manager,
      );

      await this.workspaces.updateProfile(
        input.workspaceId,
        {
          primaryUseCase,
        },
        manager,
      );
    });

    return {
      status: 'completed' as const,
    };
  }

  private createSlug(name: string, workspaceId: string): string {
    const base =
      name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'workspace';

    return `${base}-${workspaceId.slice(0, 8)}`;
  }
}
