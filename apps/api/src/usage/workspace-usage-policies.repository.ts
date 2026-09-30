import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WorkspaceUsagePolicyEntity } from './entities/workspace-usage-policy.entity.js';

@Injectable()
export class WorkspaceUsagePoliciesRepository {
  public constructor(
    @InjectRepository(WorkspaceUsagePolicyEntity)
    private readonly repository: Repository<WorkspaceUsagePolicyEntity>,
  ) {}

  public findByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceUsagePolicyEntity | null> {
    return this.repository.findOne({
      where: {
        workspaceId,
      },
    });
  }

  public async ensureForWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceUsagePolicyEntity> {
    const existing = await this.findByWorkspaceId(workspaceId);

    if (existing) {
      return existing;
    }

    const policy = this.repository.create({
      workspaceId,

      enabled: true,

      trialEndsAt: null,

      monthlyMeetingLimit: null,

      meetingCreationEnabled: true,

      livekitEnabled: true,

      disabledReason: null,
    });

    return this.repository.save(policy);
  }

  public async save(
    policy: WorkspaceUsagePolicyEntity,
  ): Promise<WorkspaceUsagePolicyEntity> {
    return this.repository.save(policy);
  }
}
