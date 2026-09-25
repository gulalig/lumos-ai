import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';

import { JiraSyncOutboxEntity } from './entities/jira-sync-outbox.entity.js';

export interface ClaimedJiraSyncJob {
  id: string;
  workspaceId: string;
  sprintItemId: string;
  revision: number;
  attempts: number;
}

const staleLockTimeoutMs = 5 * 60 * 1000;

@Injectable()
export class JiraSyncOutboxRepository {
  public constructor(private readonly dataSource: DataSource) {}

  public async enqueue(
    workspaceId: string,
    sprintItemId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const executor = manager ?? this.dataSource.manager;

    await executor.query(
      `
        INSERT INTO jira_sync_outbox (
          id,
          workspace_id,
          sprint_item_id,
          status,
          revision,
          attempts,
          available_at,
          locked_at,
          last_error,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'pending',
          1,
          0,
          now(),
          NULL,
          NULL,
          now(),
          now()
        )
        ON CONFLICT (sprint_item_id)
        DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          revision = jira_sync_outbox.revision + 1,
          status = CASE
            WHEN jira_sync_outbox.status = 'processing'
              THEN 'processing'
            ELSE 'pending'
          END,
          attempts = CASE
            WHEN jira_sync_outbox.status = 'processing'
              THEN jira_sync_outbox.attempts
            ELSE 0
          END,
          available_at = CASE
            WHEN jira_sync_outbox.status = 'processing'
              THEN jira_sync_outbox.available_at
            ELSE now()
          END,
          locked_at = CASE
            WHEN jira_sync_outbox.status = 'processing'
              THEN jira_sync_outbox.locked_at
            ELSE NULL
          END,
          last_error = NULL,
          updated_at = now()
      `,
      [randomUUID(), workspaceId, sprintItemId],
    );
  }

  public async recoverStaleProcessing(): Promise<number> {
    const staleBefore = new Date(Date.now() - staleLockTimeoutMs);

    const result = await this.dataSource.query(
      `
          UPDATE jira_sync_outbox
          SET
            status = 'pending',
            locked_at = NULL,
            available_at = now(),
            updated_at = now()
          WHERE
            status = 'processing'
            AND locked_at IS NOT NULL
            AND locked_at < $1
        `,
      [staleBefore],
    );

    if (Array.isArray(result)) {
      const metadata = result[result.length - 1];

      if (
        metadata &&
        typeof metadata === 'object' &&
        'rowCount' in metadata &&
        typeof metadata.rowCount === 'number'
      ) {
        return metadata.rowCount;
      }
    }

    return 0;
  }

  public async claimNext(): Promise<ClaimedJiraSyncJob | null> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
              SELECT
                id,
                workspace_id,
                sprint_item_id,
                revision,
                attempts
              FROM jira_sync_outbox
              WHERE
                status = 'pending'
                AND available_at <= now()
              ORDER BY
                available_at ASC,
                created_at ASC
              FOR UPDATE SKIP LOCKED
              LIMIT 1
            `,
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      const row = rows[0] as {
        id: string;
        workspace_id: string;
        sprint_item_id: string;
        revision: number;
        attempts: number;
      };

      await manager.query(
        `
            UPDATE jira_sync_outbox
            SET
              status = 'processing',
              attempts = attempts + 1,
              locked_at = now(),
              updated_at = now()
            WHERE id = $1
          `,
        [row.id],
      );

      return {
        id: row.id,

        workspaceId: row.workspace_id,

        sprintItemId: row.sprint_item_id,

        revision: row.revision,

        attempts: row.attempts + 1,
      };
    });
  }

  public async complete(
    jobId: string,
    processedRevision: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
              SELECT
                revision
              FROM jira_sync_outbox
              WHERE id = $1
              FOR UPDATE
            `,
        [jobId],
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return;
      }

      const currentRevision = Number(
        (
          rows[0] as {
            revision: unknown;
          }
        ).revision,
      );

      if (currentRevision > processedRevision) {
        await manager.query(
          `
              UPDATE jira_sync_outbox
              SET
                status = 'pending',
                attempts = 0,
                available_at = now(),
                locked_at = NULL,
                last_error = NULL,
                updated_at = now()
              WHERE id = $1
            `,
          [jobId],
        );

        return;
      }

      await manager.query(
        `
            UPDATE jira_sync_outbox
            SET
              status = 'completed',
              locked_at = NULL,
              last_error = NULL,
              updated_at = now()
            WHERE id = $1
          `,
        [jobId],
      );
    });
  }

  public async retry(
    jobId: string,
    errorMessage: string,
    delayMs: number,
  ): Promise<void> {
    const availableAt = new Date(Date.now() + delayMs);

    await this.dataSource.query(
      `
        UPDATE jira_sync_outbox
        SET
          status = 'pending',
          available_at = $2,
          locked_at = NULL,
          last_error = $3,
          updated_at = now()
        WHERE id = $1
      `,
      [jobId, availableAt, errorMessage.slice(0, 4000)],
    );
  }

  public async findBySprintItemId(
    sprintItemId: string,
  ): Promise<JiraSyncOutboxEntity | null> {
    return this.dataSource.getRepository(JiraSyncOutboxEntity).findOne({
      where: {
        sprintItemId,
      },
    });
  }
}
