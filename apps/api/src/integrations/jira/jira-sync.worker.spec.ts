import { describe, expect, it, vi } from 'vitest';

import {
  ClaimedJiraSyncJob,
  JiraSyncOutboxRepository,
} from './jira-sync-outbox.repository.js';
import { JiraSyncService } from './jira-sync.service.js';
import { JiraSyncWorker } from './jira-sync.worker.js';

function createFixture(job: ClaimedJiraSyncJob) {
  const outbox = {
    recoverStaleProcessing: vi.fn(async () => 0),

    claimNext: vi.fn().mockResolvedValueOnce(job).mockResolvedValueOnce(null),

    complete: vi.fn(),

    retry: vi.fn(),
  } as unknown as JiraSyncOutboxRepository;

  const jiraSync = {
    syncItem: vi.fn(),
  } as unknown as JiraSyncService;

  const worker = new JiraSyncWorker(outbox, jiraSync);

  return {
    worker,
    outbox,
    jiraSync,
  };
}

const job: ClaimedJiraSyncJob = {
  id: 'job-1',

  workspaceId: 'workspace-1',

  sprintItemId: 'item-1',

  revision: 3,

  attempts: 1,
};

describe('JiraSyncWorker', () => {
  it('completes a successful sync job', async () => {
    const fixture = createFixture(job);

    vi.mocked(fixture.jiraSync.syncItem).mockResolvedValue();

    await fixture.worker.onModuleInit();

    fixture.worker.onModuleDestroy();

    expect(fixture.jiraSync.syncItem).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',

      sprintItemId: 'item-1',
    });

    expect(fixture.outbox.complete).toHaveBeenCalledWith('job-1', 3);

    expect(fixture.outbox.retry).not.toHaveBeenCalled();
  });

  it('requeues a failed job with exponential backoff', async () => {
    const fixture = createFixture(job);

    vi.mocked(fixture.jiraSync.syncItem).mockRejectedValue(
      new Error('Jira unavailable'),
    );

    await fixture.worker.onModuleInit();

    fixture.worker.onModuleDestroy();

    expect(fixture.outbox.retry).toHaveBeenCalledWith(
      'job-1',
      'Jira unavailable',
      2000,
    );

    expect(fixture.outbox.complete).not.toHaveBeenCalled();
  });
});
