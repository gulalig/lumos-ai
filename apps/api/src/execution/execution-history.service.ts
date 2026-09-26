import { Injectable, NotFoundException } from '@nestjs/common';

import { SprintsRepository } from '../sprints/sprints.repository.js';

import type { ExecutionObservationLinkEntity } from './entities/execution-observation-link.entity.js';
import { ExecutionRepository } from './execution.repository.js';

@Injectable()
export class ExecutionHistoryService {
  constructor(
    private readonly executionRepository: ExecutionRepository,

    private readonly sprintsRepository: SprintsRepository,
  ) {}

  async listSprintItemHistory(
    workspaceId: string,
    sprintItemId: string,
  ): Promise<ExecutionObservationLinkEntity[]> {
    const item = await this.sprintsRepository.findItemByIdForWorkspace(
      sprintItemId,
      workspaceId,
    );

    if (!item) {
      throw new NotFoundException('Sprint item not found');
    }

    return this.executionRepository.findBySprintItemForWorkspace(
      sprintItemId,
      workspaceId,
    );
  }
}
