import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import {
  ClaimedJiraSyncJob,
  JiraSyncOutboxRepository,
} from './jira-sync-outbox.repository.js';
import { JiraSyncService } from './jira-sync.service.js';

const POLL_INTERVAL_MS = 1000;

const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

const BASE_RETRY_DELAY_MS = 2000;

@Injectable()
export class JiraSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JiraSyncWorker.name);

  private timer: NodeJS.Timeout | null = null;

  private polling = false;

  public constructor(
    private readonly outbox: JiraSyncOutboxRepository,

    private readonly jiraSync: JiraSyncService,
  ) {}

  public async onModuleInit(): Promise<void> {
    const recovered = await this.outbox.recoverStaleProcessing();

    if (recovered > 0) {
      this.logger.warn(`Recovered ${recovered} stale Jira sync job(s)`);
    }

    this.timer = setInterval(() => {
      void this.pollSafely();
    }, POLL_INTERVAL_MS);

    await this.pollSafely();
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);

      this.timer = null;
    }
  }

  private async pollSafely(): Promise<void> {
    if (this.polling) {
      return;
    }

    this.polling = true;

    try {
      await this.poll();
    } catch (error) {
      this.logger.error(
        'Jira sync poll failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.polling = false;
    }
  }

  private async poll(): Promise<void> {
    while (true) {
      const job = await this.outbox.claimNext();

      if (!job) {
        return;
      }

      await this.processJob(job);
    }
  }

  private async processJob(job: ClaimedJiraSyncJob): Promise<void> {
    try {
      await this.jiraSync.syncItem({
        workspaceId: job.workspaceId,

        sprintItemId: job.sprintItemId,
      });

      await this.outbox.complete(job.id, job.revision);

      this.logger.log(
        [
          'Jira sync completed',
          `jobId=${job.id}`,
          `workspaceId=${job.workspaceId}`,
          `sprintItemId=${job.sprintItemId}`,
          `revision=${job.revision}`,
          `attempt=${job.attempts}`,
        ].join(' '),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Jira sync error';

      const delayMs = this.retryDelay(job.attempts);

      await this.outbox.retry(job.id, message, delayMs);

      this.logger.warn(
        [
          'Jira sync failed',
          `jobId=${job.id}`,
          `workspaceId=${job.workspaceId}`,
          `sprintItemId=${job.sprintItemId}`,
          `attempt=${job.attempts}`,
          `retryInMs=${delayMs}`,
          `error=${message}`,
        ].join(' '),
      );
    }
  }

  private retryDelay(attempts: number): number {
    const exponent = Math.max(0, attempts - 1);

    return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** exponent);
  }
}
