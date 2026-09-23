import { describe, expect, it, vi } from 'vitest';

import { SprintItemEntity } from './entities/sprint-item.entity.js';
import { SprintsRepository } from './sprints.repository.js';
import { SprintsService } from './sprints.service.js';

describe('SprintsService', () => {
  it('updates due date on the same sprint item instead of creating a new item', async () => {
    const item = new SprintItemEntity();

    item.id = '11111111-1111-4111-8111-111111111111';
    item.sprintId = '22222222-2222-4222-8222-222222222222';
    item.title = 'Deliver API';
    item.description = null;
    item.status = 'todo';
    item.ownerWorkspaceMemberId =
      '33333333-3333-4333-8333-333333333333';
    item.dueAt = new Date('2026-09-25T12:00:00.000Z');
    item.blockerText = null;
    item.acceptanceCriteria = [];
    item.createdAt = new Date();
    item.updatedAt = new Date();

    const repository = {
      findItemById: vi.fn().mockResolvedValue(item),
      saveItem: vi
        .fn()
        .mockImplementation(async (savedItem: SprintItemEntity) => savedItem),
    } as unknown as SprintsRepository;

    const service = new SprintsService(repository);

    const newDueAt = new Date('2026-09-24T12:00:00.000Z');

    const result = await service.updateItem(item.id, {
      dueAt: newDueAt,
    });

    expect(result.id).toBe(item.id);
    expect(result.dueAt).toEqual(newDueAt);

    expect(repository.findItemById).toHaveBeenCalledWith(item.id);
    expect(repository.saveItem).toHaveBeenCalledTimes(1);
  });
});
