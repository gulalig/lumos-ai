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
      findSprintByIdForWorkspace: vi.fn().mockResolvedValue(sprint),

      createItem: vi.fn().mockResolvedValue(item),
    } as unknown as SprintsRepository;

    const jiraSyncOutbox = createJiraSyncOutbox();

    const service = new SprintsService(
      repository,
      createDataSource(manager),
      jiraSyncOutbox,
    );

    const result = await service.createItem(sprint.workspaceId, {
      sprintId: sprint.id,

      title: '  Deliver API  ',
    });

    expect(result).toBe(item);

    expect(repository.findSprintByIdForWorkspace).toHaveBeenCalledWith(
      sprint.id,
      sprint.workspaceId,
      manager,
    );

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
      findItemByIdForWorkspace: vi.fn().mockResolvedValue(item),

      findSprintByIdForWorkspace: vi.fn().mockResolvedValue(sprint),

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

    const result = await service.updateItem(sprint.workspaceId, item.id, {
      dueAt: newDueAt,
    });

    expect(result.id).toBe(item.id);

    expect(result.dueAt).toEqual(newDueAt);

    expect(repository.findItemByIdForWorkspace).toHaveBeenCalledWith(
      item.id,
      sprint.workspaceId,
      manager,
    );

    expect(repository.findSprintByIdForWorkspace).toHaveBeenCalledWith(
      item.sprintId,
      sprint.workspaceId,
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

  it('rejects creating an item when the sprint does not belong to the workspace', async () => {
    const manager = {} as EntityManager;

    const repository = {
      findSprintByIdForWorkspace: vi.fn().mockResolvedValue(null),

      createItem: vi.fn(),
    } as unknown as SprintsRepository;

    const jiraSyncOutbox = createJiraSyncOutbox();

    const service = new SprintsService(
      repository,
      createDataSource(manager),
      jiraSyncOutbox,
    );

    await expect(
      service.createItem('workspace-1', {
        sprintId: 'sprint-other-workspace',

        title: 'Blocked cross tenant write',
      }),
    ).rejects.toThrow('Sprint not found');

    expect(repository.createItem).not.toHaveBeenCalled();

    expect(jiraSyncOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('rejects updating an item when the item does not belong to the workspace', async () => {
    const manager = {} as EntityManager;

    const repository = {
      findItemByIdForWorkspace: vi.fn().mockResolvedValue(null),

      findSprintByIdForWorkspace: vi.fn(),
    } as unknown as SprintsRepository;

    const jiraSyncOutbox = createJiraSyncOutbox();

    const service = new SprintsService(
      repository,
      createDataSource(manager),
      jiraSyncOutbox,
    );

    await expect(
      service.updateItem('workspace-1', 'item-other-workspace', {
        status: 'done',
      }),
    ).rejects.toThrow('Sprint item not found');

    expect(repository.findSprintByIdForWorkspace).not.toHaveBeenCalled();

    expect(jiraSyncOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('gets the active sprint only for the requested workspace', async () => {
    const sprint = new SprintEntity();

    sprint.id = '22222222-2222-4222-8222-222222222222';

    sprint.workspaceId = '55555555-5555-4555-8555-555555555555';

    const manager = {} as EntityManager;

    const repository = {
      findActiveByWorkspace: vi.fn().mockResolvedValue(sprint),
    } as unknown as SprintsRepository;

    const service = new SprintsService(
      repository,
      createDataSource(manager),
      createJiraSyncOutbox(),
    );

    const result = await service.getActiveSprint(sprint.workspaceId);

    expect(result).toBe(sprint);

    expect(repository.findActiveByWorkspace).toHaveBeenCalledWith(
      sprint.workspaceId,
    );
  });

  it('gets a sprint only when it belongs to the workspace', async () => {
    const sprint = new SprintEntity();

    sprint.id = '22222222-2222-4222-8222-222222222222';

    sprint.workspaceId = '55555555-5555-4555-8555-555555555555';

    const manager = {} as EntityManager;

    const repository = {
      findSprintByIdForWorkspace: vi.fn().mockResolvedValue(sprint),
    } as unknown as SprintsRepository;

    const service = new SprintsService(
      repository,
      createDataSource(manager),
      createJiraSyncOutbox(),
    );

    const result = await service.getSprint(sprint.workspaceId, sprint.id);

    expect(result).toBe(sprint);

    expect(repository.findSprintByIdForWorkspace).toHaveBeenCalledWith(
      sprint.id,
      sprint.workspaceId,
    );
  });

  it('lists sprint items only after verifying the sprint belongs to the workspace', async () => {
    const sprint = new SprintEntity();

    sprint.id = '22222222-2222-4222-8222-222222222222';

    sprint.workspaceId = '55555555-5555-4555-8555-555555555555';

    const item = new SprintItemEntity();

    item.id = '11111111-1111-4111-8111-111111111111';

    item.sprintId = sprint.id;

    const manager = {} as EntityManager;

    const repository = {
      findSprintByIdForWorkspace: vi.fn().mockResolvedValue(sprint),

      findItemsBySprintForWorkspace: vi.fn().mockResolvedValue([item]),
    } as unknown as SprintsRepository;

    const service = new SprintsService(
      repository,
      createDataSource(manager),
      createJiraSyncOutbox(),
    );

    const result = await service.getSprintItems(sprint.workspaceId, sprint.id);

    expect(result).toEqual([item]);

    expect(repository.findSprintByIdForWorkspace).toHaveBeenCalledWith(
      sprint.id,
      sprint.workspaceId,
    );

    expect(repository.findItemsBySprintForWorkspace).toHaveBeenCalledWith(
      sprint.id,
      sprint.workspaceId,
    );
  });

  it('does not expose a sprint item from another workspace', async () => {
    const manager = {} as EntityManager;

    const repository = {
      findItemByIdForWorkspace: vi.fn().mockResolvedValue(null),
    } as unknown as SprintsRepository;

    const service = new SprintsService(
      repository,
      createDataSource(manager),
      createJiraSyncOutbox(),
    );

    await expect(
      service.getItem('workspace-1', 'item-from-another-workspace'),
    ).rejects.toThrow('Sprint item not found');

    expect(repository.findItemByIdForWorkspace).toHaveBeenCalledWith(
      'item-from-another-workspace',
      'workspace-1',
    );
  });
});
