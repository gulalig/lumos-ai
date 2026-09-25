import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';

import { JiraIssueMappingEntity } from './entities/jira-issue-mapping.entity.js';

@Injectable()
export class JiraIssueMappingsRepository {
  public constructor(
    @InjectRepository(JiraIssueMappingEntity)
    private readonly mappings: Repository<JiraIssueMappingEntity>,
  ) {}

  public async findBySprintItemId(
    sprintItemId: string,
    manager?: EntityManager,
  ): Promise<JiraIssueMappingEntity | null> {
    const repository =
      manager?.getRepository(JiraIssueMappingEntity) ?? this.mappings;

    return repository.findOne({
      where: {
        sprintItemId,
      },
    });
  }

  public async createMapping(
    input: {
      sprintItemId: string;
      jiraCloudId: string;
      jiraIssueId: string;
      jiraIssueKey: string;
    },
    manager?: EntityManager,
  ): Promise<JiraIssueMappingEntity> {
    const repository =
      manager?.getRepository(JiraIssueMappingEntity) ?? this.mappings;

    const mapping = repository.create({
      id: randomUUID(),

      sprintItemId: input.sprintItemId,

      jiraCloudId: input.jiraCloudId,

      jiraIssueId: input.jiraIssueId,

      jiraIssueKey: input.jiraIssueKey,

      lastSyncedAt: new Date(),
    });

    return repository.save(mapping);
  }

  public async markSynced(
    mapping: JiraIssueMappingEntity,
    manager?: EntityManager,
  ): Promise<JiraIssueMappingEntity> {
    const repository =
      manager?.getRepository(JiraIssueMappingEntity) ?? this.mappings;

    mapping.lastSyncedAt = new Date();

    return repository.save(mapping);
  }
}
