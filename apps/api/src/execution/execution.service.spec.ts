import type { DataSource, EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceMemberEntity } from '../identity/entities/workspace-member.entity.js';
import { MeetingEntity } from '../meetings/meeting.entity.js';
import { SprintItemEntity } from '../sprints/entities/sprint-item.entity.js';
import { SprintEntity } from '../sprints/entities/sprint.entity.js';

import { ExecutionObservationLinkEntity } from './entities/execution-observation-link.entity.js';
import { ExecutionService } from './execution.service.js';
import { JiraSyncOutboxRepository } from '../integrations/jira/jira-sync-outbox.repository.js';

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

describe('ExecutionService', () => {
  it('rejects a refinement that points to another meeting without updating its item', async () => {
    const links = {
      findOne: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        meetingId: 'another-meeting',
        sprintItemId: 'existing-item',
      }),
    };
    const items = { findOne: vi.fn(), save: vi.fn() };
    const meetings = {
      findOne: vi.fn().mockResolvedValue({
        id: 'current-meeting',
        workspaceId: 'workspace',
      }),
    };
    const manager = {
      getRepository: vi.fn((entity: unknown) => {
        if (entity === ExecutionObservationLinkEntity) return links;
        if (entity === SprintItemEntity) return items;
        if (entity === MeetingEntity) return meetings;
        throw new Error('Unexpected repository access');
      }),
    } as unknown as EntityManager;
    const outbox = createJiraSyncOutbox();
    const service = new ExecutionService(createDataSource(manager), outbox);
    await expect(
      service.applyCommitment({
        meetingId: 'current-meeting',
        observationId: 'refined',
        evidenceEventId: 'answer',
        supersedesObservationId: 'original',
        summary: 'Final review',
        ownerWorkspaceMemberId: null,
        dueAt: new Date('2026-10-05T23:59:59.999Z'),
      }),
    ).rejects.toThrow('Superseded observation belongs to another meeting');
    expect(items.findOne).not.toHaveBeenCalled();
    expect(items.save).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('returns the existing sprint item when the same observation is delivered again', async () => {
    const item = new SprintItemEntity();

    item.id = '11111111-1111-4111-8111-111111111111';

    item.sprintId = '22222222-2222-4222-8222-222222222222';

    item.title = 'Deliver API';

    item.description = null;

    item.status = 'todo';

    item.ownerWorkspaceMemberId = '33333333-3333-4333-8333-333333333333';

    item.dueAt = new Date('2026-09-25T12:00:00.000Z');

    item.blockerText = null;

    item.acceptanceCriteria = [];

    item.createdAt = new Date();

    item.updatedAt = new Date();

    const existingLink = new ExecutionObservationLinkEntity();

    existingLink.observationId = 'observation-a';

    existingLink.meetingId = '44444444-4444-4444-8444-444444444444';

    existingLink.sprintItemId = item.id;

    existingLink.kind = 'commitment';

    existingLink.evidenceEventId = 'evidence-a';

    existingLink.sprintItem = item;

    const linksRepository = {
      findOne: vi.fn().mockResolvedValue(existingLink),

      create: vi.fn(),

      save: vi.fn(),
    };

    const manager = {
      getRepository: vi.fn().mockImplementation((entity: unknown) => {
        if (entity === ExecutionObservationLinkEntity) {
          return linksRepository;
        }

        throw new Error('Unexpected repository access');
      }),
    } as unknown as EntityManager;

    const service = new ExecutionService(
      createDataSource(manager),
      createJiraSyncOutbox(),
    );

    const result = await service.applyCommitment({
      meetingId: existingLink.meetingId,

      observationId: existingLink.observationId,

      evidenceEventId: existingLink.evidenceEventId,

      summary: 'Deliver API',

      ownerWorkspaceMemberId: item.ownerWorkspaceMemberId!,

      dueAt: item.dueAt,
    });

    expect(result.id).toBe(item.id);

    expect(linksRepository.create).not.toHaveBeenCalled();

    expect(linksRepository.save).not.toHaveBeenCalled();

    expect(manager.getRepository).toHaveBeenCalledTimes(1);
  });

  it('mutates the same sprint item when a commitment supersedes a previous observation', async () => {
    const meeting = new MeetingEntity();

    meeting.id = '44444444-4444-4444-8444-444444444444';

    meeting.workspaceId = '55555555-5555-4555-8555-555555555555';

    const owner = new WorkspaceMemberEntity();

    owner.id = '33333333-3333-4333-8333-333333333333';

    owner.workspaceId = meeting.workspaceId;

    const item = new SprintItemEntity();

    item.id = '11111111-1111-4111-8111-111111111111';

    item.sprintId = '22222222-2222-4222-8222-222222222222';

    item.title = 'Deliver API';

    item.description = null;

    item.status = 'todo';

    item.ownerWorkspaceMemberId = owner.id;

    item.dueAt = new Date('2026-09-25T12:00:00.000Z');

    item.blockerText = null;

    item.acceptanceCriteria = [];

    item.createdAt = new Date();

    item.updatedAt = new Date();

    const previousLink = new ExecutionObservationLinkEntity();

    previousLink.observationId = 'observation-a';

    previousLink.meetingId = meeting.id;

    previousLink.sprintItemId = item.id;

    previousLink.kind = 'commitment';

    previousLink.evidenceEventId = 'evidence-a';

    const linksRepository = {
      findOne: vi.fn().mockImplementation(
        async (options: {
          where?: {
            observationId?: string;
          };
        }) => {
          const observationId = options.where?.observationId;

          if (observationId === 'observation-b') {
            return null;
          }

          if (observationId === 'observation-a') {
            return previousLink;
          }

          return null;
        },
      ),

      create: vi
        .fn()
        .mockImplementation((values: Partial<ExecutionObservationLinkEntity>) =>
          Object.assign(new ExecutionObservationLinkEntity(), values),
        ),

      save: vi
        .fn()
        .mockImplementation(
          async (link: ExecutionObservationLinkEntity) => link,
        ),
    };

    const meetingsRepository = {
      findOne: vi.fn().mockResolvedValue(meeting),
    };

    const membersRepository = {
      findOne: vi.fn().mockResolvedValue(owner),
    };

    const itemsRepository = {
      findOne: vi.fn().mockResolvedValue(item),

      save: vi
        .fn()
        .mockImplementation(async (savedItem: SprintItemEntity) => savedItem),
    };

    const sprintsRepository = {
      findOne: vi.fn(),
    };

    const manager = {
      getRepository: vi.fn().mockImplementation((entity: unknown) => {
        if (entity === ExecutionObservationLinkEntity) {
          return linksRepository;
        }

        if (entity === MeetingEntity) {
          return meetingsRepository;
        }

        if (entity === WorkspaceMemberEntity) {
          return membersRepository;
        }

        if (entity === SprintItemEntity) {
          return itemsRepository;
        }

        if (entity === SprintEntity) {
          return sprintsRepository;
        }

        throw new Error('Unexpected repository access');
      }),
    } as unknown as EntityManager;

    const service = new ExecutionService(
      createDataSource(manager),
      createJiraSyncOutbox(),
    );

    const newDueAt = new Date('2026-09-24T12:00:00.000Z');

    const result = await service.applyCommitment({
      meetingId: meeting.id,

      observationId: 'observation-b',

      evidenceEventId: 'evidence-b',

      summary: 'Deliver API revised',

      ownerWorkspaceMemberId: owner.id,

      dueAt: newDueAt,

      supersedesObservationId: previousLink.observationId,
    });

    expect(result.id).toBe(item.id);

    expect(result.title).toBe('Deliver API revised');

    expect(result.dueAt).toEqual(newDueAt);

    expect(result.ownerWorkspaceMemberId).toBe(owner.id);

    expect(itemsRepository.save).toHaveBeenCalledTimes(1);

    expect(linksRepository.save).toHaveBeenCalledTimes(1);

    expect(linksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        observationId: 'observation-b',

        sprintItemId: item.id,

        meetingId: meeting.id,
      }),
    );

    // Refinement must not search for or create
    // another active-sprint item.
    expect(sprintsRepository.findOne).not.toHaveBeenCalled();
  });

  it('resolves a unique owner display name inside the meeting workspace', async () => {
    const meeting = new MeetingEntity();

    meeting.id = '44444444-4444-4444-8444-444444444444';

    meeting.workspaceId = '55555555-5555-4555-8555-555555555555';

    const owner = new WorkspaceMemberEntity();

    owner.id = '33333333-3333-4333-8333-333333333333';

    owner.workspaceId = meeting.workspaceId;

    const item = new SprintItemEntity();

    item.id = '11111111-1111-4111-8111-111111111111';

    item.sprintId = '22222222-2222-4222-8222-222222222222';

    item.title = 'Ship the pricing page';

    item.description = null;

    item.status = 'todo';

    item.ownerWorkspaceMemberId = null;

    item.dueAt = new Date('2026-09-25T23:59:59.999Z');

    item.blockerText = null;

    item.acceptanceCriteria = [];

    item.createdAt = new Date();

    item.updatedAt = new Date();

    const previousLink = new ExecutionObservationLinkEntity();

    previousLink.observationId = 'observation-ownerless';

    previousLink.meetingId = meeting.id;

    previousLink.sprintItemId = item.id;

    previousLink.kind = 'commitment';

    previousLink.evidenceEventId = 'evidence-ownerless';

    const linksRepository = {
      findOne: vi.fn().mockImplementation(
        async (options: {
          where?: {
            observationId?: string;
          };
        }) => {
          const observationId = options.where?.observationId;

          if (observationId === 'observation-refined') {
            return null;
          }

          if (observationId === previousLink.observationId) {
            return previousLink;
          }

          return null;
        },
      ),

      create: vi
        .fn()
        .mockImplementation((values: Partial<ExecutionObservationLinkEntity>) =>
          Object.assign(new ExecutionObservationLinkEntity(), values),
        ),

      save: vi
        .fn()
        .mockImplementation(
          async (link: ExecutionObservationLinkEntity) => link,
        ),
    };

    const meetingsRepository = {
      findOne: vi.fn().mockResolvedValue(meeting),
    };

    const ownerQueryBuilder = {
      innerJoinAndSelect: vi.fn(),

      where: vi.fn(),

      andWhere: vi.fn(),

      take: vi.fn(),

      getMany: vi.fn().mockResolvedValue([owner]),
    };

    ownerQueryBuilder.innerJoinAndSelect.mockReturnValue(ownerQueryBuilder);

    ownerQueryBuilder.where.mockReturnValue(ownerQueryBuilder);

    ownerQueryBuilder.andWhere.mockReturnValue(ownerQueryBuilder);

    ownerQueryBuilder.take.mockReturnValue(ownerQueryBuilder);

    const membersRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(ownerQueryBuilder),

      findOne: vi.fn().mockResolvedValue(owner),
    };

    const itemsRepository = {
      findOne: vi.fn().mockResolvedValue(item),

      save: vi
        .fn()
        .mockImplementation(async (savedItem: SprintItemEntity) => savedItem),
    };

    const sprintsRepository = {
      findOne: vi.fn(),
    };

    const manager = {
      getRepository: vi.fn().mockImplementation((entity: unknown) => {
        if (entity === ExecutionObservationLinkEntity) {
          return linksRepository;
        }

        if (entity === MeetingEntity) {
          return meetingsRepository;
        }

        if (entity === WorkspaceMemberEntity) {
          return membersRepository;
        }

        if (entity === SprintItemEntity) {
          return itemsRepository;
        }

        if (entity === SprintEntity) {
          return sprintsRepository;
        }

        throw new Error('Unexpected repository access');
      }),
    } as unknown as EntityManager;

    const service = new ExecutionService(
      createDataSource(manager),
      createJiraSyncOutbox(),
    );

    const result = await service.applyCommitment({
      meetingId: meeting.id,

      observationId: 'observation-refined',

      evidenceEventId: 'evidence-refined',

      summary: 'Lumos Developer will ship the pricing page',

      ownerWorkspaceMemberId: null,

      ownerDisplayName: 'Lumos Developer',

      dueAt: null,

      supersedesObservationId: previousLink.observationId,
    });

    expect(result.ownerWorkspaceMemberId).toBe(owner.id);

    expect(membersRepository.createQueryBuilder).toHaveBeenCalledTimes(1);

    expect(ownerQueryBuilder.getMany).toHaveBeenCalledTimes(1);

    expect(membersRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: owner.id,
        workspaceId: meeting.workspaceId,
      },
    });

    expect(result.id).toBe(item.id);

    expect(result.dueAt).toEqual(new Date('2026-09-25T23:59:59.999Z'));

    expect(sprintsRepository.findOne).not.toHaveBeenCalled();
  });

  it('does not resolve an ambiguous owner display name', async () => {
    const meeting = new MeetingEntity();

    meeting.id = '44444444-4444-4444-8444-444444444444';

    meeting.workspaceId = '55555555-5555-4555-8555-555555555555';

    const firstOwner = new WorkspaceMemberEntity();

    firstOwner.id = '33333333-3333-4333-8333-333333333333';

    firstOwner.workspaceId = meeting.workspaceId;

    const secondOwner = new WorkspaceMemberEntity();

    secondOwner.id = '66666666-6666-4666-8666-666666666666';

    secondOwner.workspaceId = meeting.workspaceId;

    const item = new SprintItemEntity();

    item.id = '11111111-1111-4111-8111-111111111111';

    item.sprintId = '22222222-2222-4222-8222-222222222222';

    item.title = 'Ship the pricing page';

    item.description = null;

    item.status = 'todo';

    item.ownerWorkspaceMemberId = null;

    item.dueAt = new Date('2026-09-25T23:59:59.999Z');

    item.blockerText = null;

    item.acceptanceCriteria = [];

    item.createdAt = new Date();

    item.updatedAt = new Date();

    const previousLink = new ExecutionObservationLinkEntity();

    previousLink.observationId = 'observation-ownerless';

    previousLink.meetingId = meeting.id;

    previousLink.sprintItemId = item.id;

    previousLink.kind = 'commitment';

    previousLink.evidenceEventId = 'evidence-ownerless';

    const linksRepository = {
      findOne: vi.fn().mockImplementation(
        async (options: {
          where?: {
            observationId?: string;
          };
        }) => {
          const observationId = options.where?.observationId;

          if (observationId === 'observation-refined') {
            return null;
          }

          if (observationId === previousLink.observationId) {
            return previousLink;
          }

          return null;
        },
      ),

      create: vi
        .fn()
        .mockImplementation((values: Partial<ExecutionObservationLinkEntity>) =>
          Object.assign(new ExecutionObservationLinkEntity(), values),
        ),

      save: vi
        .fn()
        .mockImplementation(
          async (link: ExecutionObservationLinkEntity) => link,
        ),
    };

    const meetingsRepository = {
      findOne: vi.fn().mockResolvedValue(meeting),
    };

    const ownerQueryBuilder = {
      innerJoinAndSelect: vi.fn(),

      where: vi.fn(),

      andWhere: vi.fn(),

      take: vi.fn(),

      getMany: vi.fn().mockResolvedValue([firstOwner, secondOwner]),
    };

    ownerQueryBuilder.innerJoinAndSelect.mockReturnValue(ownerQueryBuilder);

    ownerQueryBuilder.where.mockReturnValue(ownerQueryBuilder);

    ownerQueryBuilder.andWhere.mockReturnValue(ownerQueryBuilder);

    ownerQueryBuilder.take.mockReturnValue(ownerQueryBuilder);

    const membersRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(ownerQueryBuilder),

      findOne: vi.fn(),
    };

    const itemsRepository = {
      findOne: vi.fn().mockResolvedValue(item),

      save: vi
        .fn()
        .mockImplementation(async (savedItem: SprintItemEntity) => savedItem),
    };

    const sprintsRepository = {
      findOne: vi.fn(),
    };

    const manager = {
      getRepository: vi.fn().mockImplementation((entity: unknown) => {
        if (entity === ExecutionObservationLinkEntity) {
          return linksRepository;
        }

        if (entity === MeetingEntity) {
          return meetingsRepository;
        }

        if (entity === WorkspaceMemberEntity) {
          return membersRepository;
        }

        if (entity === SprintItemEntity) {
          return itemsRepository;
        }

        if (entity === SprintEntity) {
          return sprintsRepository;
        }

        throw new Error('Unexpected repository access');
      }),
    } as unknown as EntityManager;

    const service = new ExecutionService(
      createDataSource(manager),
      createJiraSyncOutbox(),
    );

    const result = await service.applyCommitment({
      meetingId: meeting.id,

      observationId: 'observation-refined',

      evidenceEventId: 'evidence-refined',

      summary: 'Alex will ship the pricing page',

      ownerWorkspaceMemberId: null,

      ownerDisplayName: 'Alex',

      dueAt: null,

      supersedesObservationId: previousLink.observationId,
    });

    expect(result.ownerWorkspaceMemberId).toBeNull();

    expect(membersRepository.findOne).not.toHaveBeenCalled();

    expect(result.id).toBe(item.id);

    expect(result.dueAt).toEqual(new Date('2026-09-25T23:59:59.999Z'));

    expect(sprintsRepository.findOne).not.toHaveBeenCalled();
  });
});
