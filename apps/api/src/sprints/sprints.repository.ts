import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

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

  async createSprint(input: CreateSprintInput): Promise<SprintEntity> {
    const sprint = this.sprints.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      goal: input.goal ?? null,
      status: 'planned',
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    });

    return this.sprints.save(sprint);
  }

  async findActiveByWorkspace(
    workspaceId: string,
  ): Promise<SprintEntity | null> {
    return this.sprints.findOne({
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

  async findSprintById(id: string): Promise<SprintEntity | null> {
    return this.sprints.findOne({
      where: { id },
    });
  }

  async createItem(
    input: CreateSprintItemInput,
  ): Promise<SprintItemEntity> {
    const item = this.items.create({
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

    return this.items.save(item);
  }

  async findItemById(id: string): Promise<SprintItemEntity | null> {
    return this.items.findOne({
      where: { id },
    });
  }

  async saveItem(item: SprintItemEntity): Promise<SprintItemEntity> {
    return this.items.save(item);
  }
}
