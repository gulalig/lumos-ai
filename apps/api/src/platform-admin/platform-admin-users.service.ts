import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface PlatformAdminUserListItem {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: Date;

  memberships: Array<{
    workspaceId: string;
    workspaceName: string;
    role: 'owner' | 'admin' | 'member';
  }>;
}

@Injectable()
export class PlatformAdminUsersService {
  public constructor(private readonly dataSource: DataSource) {}

  public async listUsers(): Promise<PlatformAdminUserListItem[]> {
    const rows = await this.dataSource.query<
      Array<{
        user_id: string;
        email: string;
        display_name: string;
        email_verified_at: Date | null;
        created_at: Date;
        workspace_id: string | null;
        workspace_name: string | null;
        role: 'owner' | 'admin' | 'member' | null;
      }>
    >(`
      SELECT
        users.id AS user_id,
        users.email,
        users.display_name,
        users.email_verified_at,
        users.created_at,
        workspaces.id AS workspace_id,
        workspaces.name AS workspace_name,
        workspace_members.role
      FROM users
      LEFT JOIN workspace_members
        ON workspace_members.user_id = users.id
      LEFT JOIN workspaces
        ON workspaces.id = workspace_members.workspace_id
      ORDER BY
        users.created_at DESC,
        workspaces.name ASC
    `);

    const users = new Map<string, PlatformAdminUserListItem>();

    for (const row of rows) {
      let user = users.get(row.user_id);

      if (!user) {
        user = {
          id: row.user_id,
          email: row.email,
          displayName: row.display_name,
          emailVerified: row.email_verified_at !== null,
          createdAt: row.created_at,
          memberships: [],
        };

        users.set(row.user_id, user);
      }

      if (row.workspace_id && row.workspace_name && row.role) {
        user.memberships.push({
          workspaceId: row.workspace_id,
          workspaceName: row.workspace_name,
          role: row.role,
        });
      }
    }

    return [...users.values()];
  }
}
