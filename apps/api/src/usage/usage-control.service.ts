import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { WorkspaceUsagePoliciesRepository } from './workspace-usage-policies.repository.js';

export interface WorkspaceUsageSnapshot {
  workspaceId: string;

  enabled: boolean;

  trialEndsAt: Date | null;
  trialExpired: boolean;

  monthlyMeetingLimit: number | null;

  meetingsThisMonth: number;

  meetingCreationEnabled: boolean;

  livekitEnabled: boolean;

  disabledReason: string | null;
}

@Injectable()
export class UsageControlService {
  public constructor(
    private readonly policies: WorkspaceUsagePoliciesRepository,
    private readonly dataSource: DataSource,
  ) {}

  public async getWorkspaceUsage(
    workspaceId: string,
  ): Promise<WorkspaceUsageSnapshot> {
    const policy = await this.policies.ensureForWorkspace(workspaceId);

    const result = await this.dataSource.query<
      Array<{
        count: string;
      }>
    >(
      `
        SELECT COUNT(*)::text AS count
        FROM meetings
        WHERE workspace_id = $1
          AND created_at >= date_trunc(
            'month',
            CURRENT_TIMESTAMP
          )
          AND created_at < (
            date_trunc(
              'month',
              CURRENT_TIMESTAMP
            )
            + INTERVAL '1 month'
          )
      `,
      [workspaceId],
    );

    const meetingsThisMonth = Number.parseInt(result[0]?.count ?? '0', 10);

    const now = new Date();

    const trialExpired =
      policy.trialEndsAt !== null &&
      policy.trialEndsAt.getTime() <= now.getTime();

    return {
      workspaceId,

      enabled: policy.enabled,

      trialEndsAt: policy.trialEndsAt,

      trialExpired,

      monthlyMeetingLimit: policy.monthlyMeetingLimit,

      meetingsThisMonth,

      meetingCreationEnabled: policy.meetingCreationEnabled,

      livekitEnabled: policy.livekitEnabled,

      disabledReason: policy.disabledReason,
    };
  }

  public async assertMeetingCreationAllowed(
    workspaceId: string,
  ): Promise<void> {
    const usage = await this.getWorkspaceUsage(workspaceId);

    if (!usage.enabled) {
      throw new ForbiddenException(
        usage.disabledReason ?? 'Workspace usage is disabled',
      );
    }

    if (!usage.meetingCreationEnabled) {
      throw new ForbiddenException(
        'Meeting creation is disabled for this workspace',
      );
    }

    if (usage.trialExpired) {
      throw new ForbiddenException('Workspace trial has expired');
    }

    if (
      usage.monthlyMeetingLimit !== null &&
      usage.meetingsThisMonth >= usage.monthlyMeetingLimit
    ) {
      throw new ForbiddenException('Monthly meeting limit reached');
    }
  }

  public async assertLiveKitAllowed(workspaceId: string): Promise<void> {
    const usage = await this.getWorkspaceUsage(workspaceId);

    if (!usage.enabled) {
      throw new ForbiddenException(
        usage.disabledReason ?? 'Workspace usage is disabled',
      );
    }

    if (!usage.livekitEnabled) {
      throw new ForbiddenException(
        'Live meeting access is disabled for this workspace',
      );
    }

    if (usage.trialExpired) {
      throw new ForbiddenException('Workspace trial has expired');
    }
  }
}
