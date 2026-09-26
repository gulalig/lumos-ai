import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';

import { SprintItemEntity } from './entities/sprint-item.entity.js';
import { SprintEntity } from './entities/sprint.entity.js';

export interface CreateSprintInput {
  workspaceId: string;
  name: string;
  goal?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface CreateSprintItemInput {
  sprintId: string;
  title: string;
  description?: string | null;
  ownerWorkspaceMemberId?: string | null;
  dueAt?: Date | null;
  acceptanceCriteria?: string[];
}

@Injectable()
export class SprintsRepository {
  constructor(
    @InjectRepository(SprintEntity)
    private readonly sprints: Repository<SprintEntity>,

    @InjectRepository(SprintItemEntity)
    private readonly items: Repository<SprintItemEntity>,
  ) {}

  async createSprint(
    input: CreateSprintInput,
    manager?: EntityManager,
  ): Promise<SprintEntity> {
    const repository = manager?.getRepository(SprintEntity) ?? this.sprints;

    const sprint = repository.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      goal: input.goal ?? null,
      status: 'planned',
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    });

    return repository.save(sprint);
  }

  async findSprintById(
    id: string,
    manager?: EntityManager,
  ): Promise<SprintEntity | null> {
    const repository = manager?.getRepository(SprintEntity) ?? this.sprints;

    return repository.findOne({
      where: {
        id,
      },
    });
  }

  async findSprintByIdForWorkspace(
    id: string,
    workspaceId: string,
    manager?: EntityManager,
  ): Promise<SprintEntity | null> {
    const repository = manager?.getRepository(SprintEntity) ?? this.sprints;

    return repository.findOne({
      where: {
        id,
        workspaceId,
      },
    });
  }

  async createItem(
    input: CreateSprintItemInput,
    manager?: EntityManager,
  ): Promise<SprintItemEntity> {
    const repository = manager?.getRepository(SprintItemEntity) ?? this.items;

    const item = repository.create({
      id: randomUUID(),
      sprintId: input.sprintId,
      title: input.title,
      description: input.description ?? null,
      status: 'todo',
      ownerWorkspaceMemberId: input.ownerWorkspaceMemberId ?? null,
      dueAt: input.dueAt ?? null,
      blockerText: null,
      acceptanceCriteria: input.acceptanceCriteria ?? [],
    });

    return repository.save(item);
  }

  async findItemById(
    id: string,
    manager?: EntityManager,
  ): Promise<SprintItemEntity | null> {
    const repository = manager?.getRepository(SprintItemEntity) ?? this.items;

    return repository.findOne({
      where: {
        id,
      },
    });
  }

  async findItemByIdForWorkspace(
    id: string,
    workspaceId: string,
    manager?: EntityManager,
  ): Promise<SprintItemEntity | null> {
    const repository = manager?.getRepository(SprintItemEntity) ?? this.items;

    return repository
      .createQueryBuilder('item')
      .innerJoin('item.sprint', 'sprint')
      .where('item.id = :id', {
        id,
      })
      .andWhere('sprint.workspaceId = :workspaceId', {
        workspaceId,
      })
      .getOne();
  }

  async saveItem(
    item: SprintItemEntity,
    manager?: EntityManager,
  ): Promise<SprintItemEntity> {
    const repository = manager?.getRepository(SprintItemEntity) ?? this.items;

    return repository.save(item);
  }

  async findItemsBySprintForWorkspace(
    sprintId: string,
    workspaceId: string,
    manager?: EntityManager,
  ): Promise<SprintItemEntity[]> {
    const repository = manager?.getRepository(SprintItemEntity) ?? this.items;

    return repository
      .createQueryBuilder('item')
      .innerJoin('item.sprint', 'sprint')
      .where('item.sprintId = :sprintId', {
        sprintId,
      })
      .andWhere('sprint.workspaceId = :workspaceId', {
        workspaceId,
      })
      .orderBy('item.createdAt', 'ASC')
      .getMany();
  }

  async findActiveByWorkspace(
    workspaceId: string,
    manager?: EntityManager,
  ): Promise<SprintEntity | null> {
    const repository = manager?.getRepository(SprintEntity) ?? this.sprints;

    return repository.findOne({
      where: {
        workspaceId,
        status: 'active',
      },
      order: {
        startsAt: 'DESC',
        createdAt: 'DESC',
      },
    });
  }
}
