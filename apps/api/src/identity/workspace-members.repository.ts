import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import {
  WorkspaceMemberEntity,
  type WorkspaceMemberRole,
} from './entities/workspace-member.entity.js';

export interface CreateWorkspaceMemberInput {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  jobTitle?: string | null;
  teamName?: string | null;
}

export interface UpdateWorkspaceMemberProfileInput {
  jobTitle?: string | null;
  teamName?: string | null;
}

@Injectable()
export class WorkspaceMembersRepository {
  public constructor(
    @InjectRepository(WorkspaceMemberEntity)
    private readonly repository: Repository<WorkspaceMemberEntity>,
  ) {}

  public async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<WorkspaceMemberEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        id,
      },

      relations: {
        user: true,
        workspace: true,
      },
    });
  }

  public async findFirstByUserId(
    userId: string,
    manager?: EntityManager,
  ): Promise<WorkspaceMemberEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        userId,
      },

      relations: {
        user: true,
        workspace: true,
      },

      order: {
        createdAt: 'ASC',
      },
    });
  }

  public async create(
    input: CreateWorkspaceMemberInput,
    manager?: EntityManager,
  ): Promise<WorkspaceMemberEntity> {
    const repository = this.getRepository(manager);

    const member = repository.create({
      id: input.id,

      workspaceId: input.workspaceId,

      userId: input.userId,

      role: input.role,

      jobTitle: input.jobTitle ?? null,

      teamName: input.teamName ?? null,
    });

    return repository.save(member);
  }

  public async updateProfile(
    memberId: string,
    input: UpdateWorkspaceMemberProfileInput,
    manager?: EntityManager,
  ): Promise<WorkspaceMemberEntity> {
    const repository = this.getRepository(manager);

    const member = await repository.findOneByOrFail({
      id: memberId,
    });

    if (input.jobTitle !== undefined) {
      member.jobTitle = input.jobTitle;
    }

    if (input.teamName !== undefined) {
      member.teamName = input.teamName;
    }

    return repository.save(member);
  }

  private getRepository(
    manager?: EntityManager,
  ): Repository<WorkspaceMemberEntity> {
    return manager
      ? manager.getRepository(WorkspaceMemberEntity)
      : this.repository;
  }
}
