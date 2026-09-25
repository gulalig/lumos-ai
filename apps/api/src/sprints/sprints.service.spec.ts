import type { DataSource, EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { JiraSyncOutboxRepository } from '../integrations/jira/jira-sync-outbox.repository.js';

import { SprintItemEntity } from './entities/sprint-item.entity.js';
import { SprintEntity } from './entities/sprint.entity.js';
import { SprintsRepository } from './sprints.repository.js';
import { SprintsService } from './sprints.service.js';

function createDataSource(manager: EntityManager): DataSource {
  return {
    transaction: vi
      .fn()
      .mockImplementation(
        async (work: (transactionManager: EntityManager) => Promise<unknown>) =>
          work(manager),
      ),
  } as unknown as DataSource;
}

function createJiraSyncOutbox(): JiraSyncOutboxRepository {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
  } as unknown as JiraSyncOutboxRepository;
}

describe('SprintsService', () => {
  it('creates a sprint item and enqueues Jira sync in the same transaction', async () => {
    const sprint = new SprintEntity();

    sprint.id = '22222222-2222-4222-8222-222222222222';

    sprint.workspaceId = '55555555-5555-4555-8555-555555555555';

    sprint.name = 'Sprint 1';

    sprint.goal = null;

    sprint.status = 'active';

    sprint.startsAt = null;

    sprint.endsAt = null;

    sprint.createdAt = new Date();

    sprint.updatedAt = new Date();

    const item = new SprintItemEntity();

    item.id = '11111111-1111-4111-8111-111111111111';

    item.sprintId = sprint.id;

    item.title = 'Deliver API';

    item.description = null;

    item.status = 'todo';

    item.ownerWorkspaceMemberId = null;

    item.dueAt = null;

    item.blockerText = null;

    item.acceptanceCriteria = [];

    item.createdAt = new Date();

    item.updatedAt = new Date();

    const manager = {} as EntityManager;

    const repository = {
      findSprintById: vi.fn().mockResolvedValue(sprint),

      createItem: vi.fn().mockResolvedValue(item),
    } as unknown as SprintsRepository;

    const jiraSyncOutbox = createJiraSyncOutbox();

    const service = new SprintsService(
      repository,
      createDataSource(manager),
      jiraSyncOutbox,
    );

    const result = await service.createItem({
      sprintId: sprint.id,

      title: '  Deliver API  ',
    });

    expect(result).toBe(item);

    expect(repository.findSprintById).toHaveBeenCalledWith(sprint.id, manager);

    expect(repository.createItem).toHaveBeenCalledWith(
      {
        sprintId: sprint.id,

        title: 'Deliver API',
      },
      manager,
    );

    expect(jiraSyncOutbox.enqueue).toHaveBeenCalledWith(
      sprint.workspaceId,
      item.id,
      manager,
    );

    expect(jiraSyncOutbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('updates due date on the same sprint item and enqueues Jira sync in the same transaction', async () => {
    const sprint = new SprintEntity();

    sprint.id = '22222222-2222-4222-8222-222222222222';

    sprint.workspaceId = '55555555-5555-4555-8555-555555555555';

    sprint.name = 'Sprint 1';

    sprint.goal = null;

    sprint.status = 'active';

    sprint.startsAt = null;

    sprint.endsAt = null;

    sprint.createdAt = new Date();

    sprint.updatedAt = new Date();

    const item = new SprintItemEntity();

    item.id = '11111111-1111-4111-8111-111111111111';

    item.sprintId = sprint.id;

    item.title = 'Deliver API';

    item.description = null;

    item.status = 'todo';

    item.ownerWorkspaceMemberId = '33333333-3333-4333-8333-333333333333';

    item.dueAt = new Date('2026-09-25T12:00:00.000Z');

    item.blockerText = null;

    item.acceptanceCriteria = [];

    item.createdAt = new Date();

    item.updatedAt = new Date();

    const manager = {} as EntityManager;

    const repository = {
      findItemById: vi.fn().mockResolvedValue(item),

      findSprintById: vi.fn().mockResolvedValue(sprint),

      saveItem: vi
        .fn()
        .mockImplementation(async (savedItem: SprintItemEntity) => savedItem),
    } as unknown as SprintsRepository;

    const jiraSyncOutbox = createJiraSyncOutbox();

    const service = new SprintsService(
      repository,
      createDataSource(manager),
      jiraSyncOutbox,
    );

    const newDueAt = new Date('2026-09-24T12:00:00.000Z');

    const result = await service.updateItem(item.id, {
      dueAt: newDueAt,
    });

    expect(result.id).toBe(item.id);

    expect(result.dueAt).toEqual(newDueAt);

    expect(repository.findItemById).toHaveBeenCalledWith(item.id, manager);

    expect(repository.findSprintById).toHaveBeenCalledWith(
      item.sprintId,
      manager,
    );

    expect(repository.saveItem).toHaveBeenCalledWith(item, manager);

    expect(jiraSyncOutbox.enqueue).toHaveBeenCalledWith(
      sprint.workspaceId,
      item.id,
      manager,
    );

    expect(jiraSyncOutbox.enqueue).toHaveBeenCalledTimes(1);
  });
});
