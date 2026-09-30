import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { UsageControlService } from '../usage/usage-control.service.js';
import { WorkspaceUsagePoliciesRepository } from '../usage/workspace-usage-policies.repository.js';

export interface PlatformAdminWorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;

  owner: {
    userId: string;
    displayName: string;
    email: string;
  } | null;

  memberCount: number;
  meetingCount: number;

  jira: {
    status: 'not_configured' | 'pending' | 'connected' | 'error';

    siteName: string | null;
    projectKey: string | null;
    projectName: string | null;
    lastError: string | null;
  };
}

export interface PlatformAdminWorkspaceUsage {
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

export interface UpdatePlatformAdminWorkspaceUsageInput {
  enabled: boolean;

  trialEndsAt: Date | null;

  monthlyMeetingLimit: number | null;

  meetingCreationEnabled: boolean;

  livekitEnabled: boolean;

  disabledReason: string | null;
}

@Injectable()
export class PlatformAdminWorkspacesService {
  public constructor(
    private readonly dataSource: DataSource,

    private readonly usage: UsageControlService,

    private readonly policies: WorkspaceUsagePoliciesRepository,
  ) {}

  public async listWorkspaces(): Promise<PlatformAdminWorkspaceListItem[]> {
    const rows = await this.dataSource.query<
      Array<{
        workspace_id: string;
        workspace_name: string;
        workspace_slug: string;
        workspace_created_at: Date;

        owner_user_id: string | null;

        owner_display_name: string | null;

        owner_email: string | null;

        member_count: string;
        meeting_count: string;

        jira_status: 'pending' | 'connected' | 'error' | null;

        jira_site_name: string | null;

        jira_project_key: string | null;

        jira_project_name: string | null;

        jira_last_error: string | null;
      }>
    >(`
        SELECT
          workspace.id AS workspace_id,
          workspace.name AS workspace_name,
          workspace.slug AS workspace_slug,
          workspace.created_at AS workspace_created_at,

          owner_user.id AS owner_user_id,
          owner_user.display_name AS owner_display_name,
          owner_user.email AS owner_email,

          COALESCE(
            member_stats.member_count,
            0
          )::text AS member_count,

          COALESCE(
            meeting_stats.meeting_count,
            0
          )::text AS meeting_count,

          jira.status AS jira_status,
          jira.site_name AS jira_site_name,
          jira.project_key AS jira_project_key,
          jira.project_name AS jira_project_name,
          jira.last_error AS jira_last_error

        FROM workspaces AS workspace

        LEFT JOIN LATERAL (
          SELECT
            member.user_id
          FROM workspace_members AS member
          WHERE member.workspace_id =
            workspace.id
            AND member.role = 'owner'
          ORDER BY member.created_at ASC
          LIMIT 1
        ) AS owner_member
          ON TRUE

        LEFT JOIN users AS owner_user
          ON owner_user.id =
            owner_member.user_id

        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS member_count
          FROM workspace_members AS member
          WHERE member.workspace_id =
            workspace.id
        ) AS member_stats
          ON TRUE

        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS meeting_count
          FROM meetings AS meeting
          WHERE meeting.workspace_id =
            workspace.id
        ) AS meeting_stats
          ON TRUE

        LEFT JOIN atlassian_connections AS jira
          ON jira.workspace_id =
            workspace.id

        ORDER BY workspace.created_at DESC
      `);

    return rows.map((row) => ({
      id: row.workspace_id,

      name: row.workspace_name,

      slug: row.workspace_slug,

      createdAt: row.workspace_created_at,

      owner:
        row.owner_user_id && row.owner_display_name && row.owner_email
          ? {
              userId: row.owner_user_id,

              displayName: row.owner_display_name,

              email: row.owner_email,
            }
          : null,

      memberCount: Number.parseInt(row.member_count, 10),

      meetingCount: Number.parseInt(row.meeting_count, 10),

      jira: {
        status: row.jira_status ?? 'not_configured',

        siteName: row.jira_site_name,

        projectKey: row.jira_project_key,

        projectName: row.jira_project_name,

        lastError: row.jira_last_error,
      },
    }));
  }

  public async getWorkspaceUsage(
    workspaceId: string,
  ): Promise<PlatformAdminWorkspaceUsage> {
    await this.assertWorkspaceExists(workspaceId);

    return this.usage.getWorkspaceUsage(workspaceId);
  }

  public async updateWorkspaceUsage(
    workspaceId: string,
    input: UpdatePlatformAdminWorkspaceUsageInput,
  ): Promise<PlatformAdminWorkspaceUsage> {
    await this.assertWorkspaceExists(workspaceId);

    const policy = await this.policies.ensureForWorkspace(workspaceId);

    policy.enabled = input.enabled;

    policy.trialEndsAt = input.trialEndsAt;

    policy.monthlyMeetingLimit = input.monthlyMeetingLimit;

    policy.meetingCreationEnabled = input.meetingCreationEnabled;

    policy.livekitEnabled = input.livekitEnabled;

    policy.disabledReason = input.disabledReason;

    await this.policies.save(policy);

    return this.usage.getWorkspaceUsage(workspaceId);
  }

  private async assertWorkspaceExists(workspaceId: string): Promise<void> {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
      }>
    >(
      `
          SELECT id
          FROM workspaces
          WHERE id = $1
          LIMIT 1
        `,
      [workspaceId],
    );

    if (!rows[0]) {
      throw new NotFoundException(`Workspace ${workspaceId} was not found`);
    }
  }
}
