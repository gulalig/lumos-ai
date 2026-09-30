import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

export interface PlatformAdminSystemResponse {
  health: {
    postgres: 'up' | 'down';
    redis: 'up' | 'down';
    overall: 'healthy' | 'degraded';
  };

  jiraSync: {
    pending: number;
    processing: number;
    completed: number;
    retried: number;
  };

  recentErrors: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string | null;
    sprintItemId: string;
    attempts: number;
    lastError: string;
    updatedAt: Date;
  }>;
}

@Injectable()
export class PlatformAdminSystemService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  public async getSystemStatus(): Promise<PlatformAdminSystemResponse> {
    const [postgresHealthy, redisHealthy, queueRows, recentErrors] =
      await Promise.all([
        this.database.isHealthy(),
        this.redis.isHealthy(),

        this.dataSource.query<
          Array<{
            status: string;
            count: string;
          }>
        >(`
          SELECT
            status,
            COUNT(*)::text AS count
          FROM jira_sync_outbox
          GROUP BY status
        `),

        this.dataSource.query<
          Array<{
            id: string;
            workspace_id: string;
            workspace_name: string | null;
            sprint_item_id: string;
            attempts: number;
            last_error: string;
            updated_at: Date;
          }>
        >(`
          SELECT
            job.id,
            job.workspace_id,
            workspace.name AS workspace_name,
            job.sprint_item_id,
            job.attempts,
            job.last_error,
            job.updated_at
          FROM jira_sync_outbox AS job
          LEFT JOIN workspaces AS workspace
            ON workspace.id = job.workspace_id
          WHERE job.last_error IS NOT NULL
          ORDER BY job.updated_at DESC
          LIMIT 10
        `),
      ]);

    const jiraSync = {
      pending: 0,
      processing: 0,
      completed: 0,
      retried: 0,
    };

    for (const row of queueRows) {
      const count = Number.parseInt(row.count, 10);

      if (row.status === 'pending') {
        jiraSync.pending = count;
      }

      if (row.status === 'processing') {
        jiraSync.processing = count;
      }

      if (row.status === 'completed') {
        jiraSync.completed = count;
      }
    }

    const retriedResult = await this.dataSource.query<
      Array<{ count: string }>
    >(`
      SELECT COUNT(*)::text AS count
      FROM jira_sync_outbox
      WHERE attempts > 1
    `);

    jiraSync.retried = Number.parseInt(retriedResult[0]?.count ?? '0', 10);

    return {
      health: {
        postgres: postgresHealthy ? 'up' : 'down',

        redis: redisHealthy ? 'up' : 'down',

        overall: postgresHealthy && redisHealthy ? 'healthy' : 'degraded',
      },

      jiraSync,

      recentErrors: recentErrors.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        workspaceName: row.workspace_name,
        sprintItemId: row.sprint_item_id,
        attempts: row.attempts,
        lastError: row.last_error,
        updatedAt: row.updated_at,
      })),
    };
  }
}
