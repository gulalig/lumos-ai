import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface PlatformAdminOverview {
  summary: {
    totalUsers: number;
    totalWorkspaces: number;
    activeWorkspaces: number;
    totalMeetings: number;
    jiraConnectedWorkspaces: number;
    recentSignups: number;
  };

  recentUsers: Array<{
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
  }>;

  recentWorkspaces: Array<{
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    memberCount: number;
  }>;

  jira: {
    connected: number;
    pending: number;
    error: number;
  };
}

@Injectable()
export class PlatformAdminOverviewService {
  public constructor(private readonly dataSource: DataSource) {}

  public async getOverview(): Promise<PlatformAdminOverview> {
    const [
      totalUsersResult,
      totalWorkspacesResult,
      activeWorkspacesResult,
      totalMeetingsResult,
      jiraConnectedResult,
      recentSignupsResult,
      jiraStatusRows,
      recentUsersRows,
      recentWorkspaceRows,
    ] = await Promise.all([
      this.dataSource.query<Array<{ count: string }>>(`
        SELECT COUNT(*)::text AS count
        FROM users
      `),

      this.dataSource.query<Array<{ count: string }>>(`
        SELECT COUNT(*)::text AS count
        FROM workspaces
      `),

      this.dataSource.query<Array<{ count: string }>>(`
        SELECT COUNT(DISTINCT workspace_id)::text AS count
        FROM meetings
        WHERE workspace_id IS NOT NULL
          AND created_at >= NOW() - INTERVAL '30 days'
      `),

      this.dataSource.query<Array<{ count: string }>>(`
        SELECT COUNT(*)::text AS count
        FROM meetings
      `),

      this.dataSource.query<Array<{ count: string }>>(`
        SELECT COUNT(*)::text AS count
        FROM atlassian_connections
        WHERE status = 'connected'
      `),

      this.dataSource.query<Array<{ count: string }>>(`
        SELECT COUNT(*)::text AS count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),

      this.dataSource.query<
        Array<{
          status: 'pending' | 'connected' | 'error';
          count: string;
        }>
      >(`
        SELECT status, COUNT(*)::text AS count
        FROM atlassian_connections
        GROUP BY status
      `),

      this.dataSource.query<
        Array<{
          id: string;
          email: string;
          display_name: string;
          created_at: Date;
        }>
      >(`
        SELECT
          id,
          email,
          display_name,
          created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 6
      `),

      this.dataSource.query<
        Array<{
          id: string;
          name: string;
          slug: string;
          created_at: Date;
          member_count: string;
        }>
      >(`
        SELECT
          workspace.id,
          workspace.name,
          workspace.slug,
          workspace.created_at,
          COUNT(member.id)::text AS member_count
        FROM workspaces AS workspace
        LEFT JOIN workspace_members AS member
          ON member.workspace_id = workspace.id
        GROUP BY
          workspace.id,
          workspace.name,
          workspace.slug,
          workspace.created_at
        ORDER BY workspace.created_at DESC
        LIMIT 6
      `),
    ]);

    const jira = {
      connected: 0,
      pending: 0,
      error: 0,
    };

    for (const row of jiraStatusRows) {
      jira[row.status] = Number.parseInt(row.count, 10);
    }

    return {
      summary: {
        totalUsers: Number.parseInt(totalUsersResult[0]?.count ?? '0', 10),

        totalWorkspaces: Number.parseInt(
          totalWorkspacesResult[0]?.count ?? '0',
          10,
        ),

        activeWorkspaces: Number.parseInt(
          activeWorkspacesResult[0]?.count ?? '0',
          10,
        ),

        totalMeetings: Number.parseInt(
          totalMeetingsResult[0]?.count ?? '0',
          10,
        ),

        jiraConnectedWorkspaces: Number.parseInt(
          jiraConnectedResult[0]?.count ?? '0',
          10,
        ),

        recentSignups: Number.parseInt(
          recentSignupsResult[0]?.count ?? '0',
          10,
        ),
      },

      recentUsers: recentUsersRows.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at,
      })),

      recentWorkspaces: recentWorkspaceRows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: row.created_at,
        memberCount: Number.parseInt(row.member_count, 10),
      })),

      jira,
    };
  }
}
