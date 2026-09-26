import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { SprintsRepository } from '../sprints/sprints.repository.js';

import { ExecutionHistoryService } from './execution-history.service.js';
import type { ExecutionRepository } from './execution.repository.js';

function createFixture() {
  const executionRepository = {
    findBySprintItemForWorkspace: vi.fn(),
  } as unknown as ExecutionRepository;

  const sprintsRepository = {
    findItemByIdForWorkspace: vi.fn(),
  } as unknown as SprintsRepository;

  const service = new ExecutionHistoryService(
    executionRepository,
    sprintsRepository,
  );

  return {
    service,
    executionRepository,
    sprintsRepository,
  };
}

describe('ExecutionHistoryService', () => {
  it('returns sprint item history only for the requested workspace', async () => {
    const fixture = createFixture();

    vi.mocked(
      fixture.sprintsRepository.findItemByIdForWorkspace,
    ).mockResolvedValue({} as never);

    vi.mocked(
      fixture.executionRepository.findBySprintItemForWorkspace,
    ).mockResolvedValue([
      {
        observationId: 'observation-1',

        meetingId: '22222222-2222-4222-8222-222222222222',

        sprintItemId: '11111111-1111-4111-8111-111111111111',

        kind: 'commitment',

        evidenceEventId: 'event-1',

        appliedAt: new Date('2026-09-26T18:00:00.000Z'),

        meeting: undefined as never,

        sprintItem: undefined as never,
      },
    ]);

    const result = await fixture.service.listSprintItemHistory(
      'workspace-1',
      '11111111-1111-4111-8111-111111111111',
    );

    expect(result).toHaveLength(1);

    expect(
      fixture.sprintsRepository.findItemByIdForWorkspace,
    ).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'workspace-1',
    );

    expect(
      fixture.executionRepository.findBySprintItemForWorkspace,
    ).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'workspace-1',
    );
  });

  it('does not expose history for a sprint item outside the workspace', async () => {
    const fixture = createFixture();

    vi.mocked(
      fixture.sprintsRepository.findItemByIdForWorkspace,
    ).mockResolvedValue(null);

    await expect(
      fixture.service.listSprintItemHistory(
        'workspace-1',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(
      fixture.executionRepository.findBySprintItemForWorkspace,
    ).not.toHaveBeenCalled();
  });
});
