import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface PlatformAdminIntegrationListItem {
  id: string;

  workspace: {
    id: string;
    name: string;
    slug: string;
  };

  status: 'pending' | 'connected' | 'error';

  site: {
    name: string | null;
    url: string | null;
  };

  project: {
    id: string | null;
    key: string | null;
    name: string | null;
  };

  accessTokenExpiresAt: Date | null;
  lastError: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformAdminIntegrationsResponse {
  summary: {
    total: number;
    connected: number;
    pending: number;
    error: number;
  };

  integrations: PlatformAdminIntegrationListItem[];
}

@Injectable()
export class PlatformAdminIntegrationsService {
  public constructor(private readonly dataSource: DataSource) {}

  public async listIntegrations(): Promise<PlatformAdminIntegrationsResponse> {
    const rows = await this.dataSource.query<
      Array<{
        id: string;

        workspace_id: string;
        workspace_name: string;
        workspace_slug: string;

        status: 'pending' | 'connected' | 'error';

        site_name: string | null;
        site_url: string | null;

        project_id: string | null;
        project_key: string | null;
        project_name: string | null;

        access_token_expires_at: Date | null;
        last_error: string | null;

        created_at: Date;
        updated_at: Date;
      }>
    >(`
      SELECT
        connection.id,

        workspace.id AS workspace_id,
        workspace.name AS workspace_name,
        workspace.slug AS workspace_slug,

        connection.status,

        connection.site_name,
        connection.site_url,

        connection.project_id,
        connection.project_key,
        connection.project_name,

        connection.access_token_expires_at,
        connection.last_error,

        connection.created_at,
        connection.updated_at

      FROM atlassian_connections AS connection

      INNER JOIN workspaces AS workspace
        ON workspace.id = connection.workspace_id

      ORDER BY connection.updated_at DESC
    `);

    const summary = {
      total: rows.length,
      connected: 0,
      pending: 0,
      error: 0,
    };

    for (const row of rows) {
      summary[row.status] += 1;
    }

    return {
      summary,

      integrations: rows.map((row) => ({
        id: row.id,

        workspace: {
          id: row.workspace_id,
          name: row.workspace_name,
          slug: row.workspace_slug,
        },

        status: row.status,

        site: {
          name: row.site_name,
          url: row.site_url,
        },

        project: {
          id: row.project_id,
          key: row.project_key,
          name: row.project_name,
        },

        accessTokenExpiresAt: row.access_token_expires_at,

        lastError: row.last_error,

        createdAt: row.created_at,

        updatedAt: row.updated_at,
      })),
    };
  }
}
