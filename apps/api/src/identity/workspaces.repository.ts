import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { WorkspaceEntity } from './entities/workspace.entity.js';

export interface CreateWorkspaceInput {
  id: string;
  name: string;
  slug: string;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  primaryUseCase?: string | null;
}

export interface UpdateWorkspaceProfileInput {
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  primaryUseCase?: string | null;
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

      industry: input.industry ?? null,

      companySize: input.companySize ?? null,

      website: input.website ?? null,

      primaryUseCase: input.primaryUseCase ?? null,
    });

    return repository.save(workspace);
  }

  public async updateProfile(
    workspaceId: string,
    input: UpdateWorkspaceProfileInput,
    manager?: EntityManager,
  ): Promise<WorkspaceEntity> {
    const repository = this.getRepository(manager);

    const workspace = await repository.findOneByOrFail({
      id: workspaceId,
    });

    if (input.industry !== undefined) {
      workspace.industry = input.industry;
    }

    if (input.companySize !== undefined) {
      workspace.companySize = input.companySize;
    }

    if (input.website !== undefined) {
      workspace.website = input.website;
    }

    if (input.primaryUseCase !== undefined) {
      workspace.primaryUseCase = input.primaryUseCase;
    }

    return repository.save(workspace);
  }

  private getRepository(manager?: EntityManager): Repository<WorkspaceEntity> {
    return manager ? manager.getRepository(WorkspaceEntity) : this.repository;
  }
}
