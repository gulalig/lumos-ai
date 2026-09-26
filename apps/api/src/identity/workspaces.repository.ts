import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { WorkspaceEntity } from './entities/workspace.entity.js';

export interface CreateWorkspaceInput {
  id: string;
  name: string;
  slug: string;
}

@Injectable()
export class WorkspacesRepository {
  public constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly repository: Repository<WorkspaceEntity>,
  ) {}

  public async create(
    input: CreateWorkspaceInput,
    manager?: EntityManager,
  ): Promise<WorkspaceEntity> {
    const repository = this.getRepository(manager);

    const workspace = repository.create({
      id: input.id,

      name: input.name.trim(),

      slug: input.slug,
    });

    return repository.save(workspace);
  }

  private getRepository(manager?: EntityManager): Repository<WorkspaceEntity> {
    return manager ? manager.getRepository(WorkspaceEntity) : this.repository;
  }
}
