import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CreateSprintInput,
  CreateSprintItemInput,
  SprintsRepository,
} from './sprints.repository.js';
import {
  SprintItemEntity,
  SprintItemStatus,
} from './entities/sprint-item.entity.js';
import { SprintEntity } from './entities/sprint.entity.js';

export interface UpdateSprintItemInput {
  title?: string;
  description?: string | null;
  status?: SprintItemStatus;
  ownerWorkspaceMemberId?: string | null;
  dueAt?: Date | null;
  blockerText?: string | null;
  acceptanceCriteria?: string[];
}

@Injectable()
export class SprintsService {
  constructor(
    private readonly repository: SprintsRepository,
  ) {}

  async createSprint(input: CreateSprintInput): Promise<SprintEntity> {
    const name = input.name.trim();

    if (!name) {
      throw new BadRequestException('Sprint name is required');
    }

    if (
      input.startsAt &&
      input.endsAt &&
      input.endsAt <= input.startsAt
    ) {
      throw new BadRequestException(
        'Sprint end must be after sprint start',
      );
    }

    return this.repository.createSprint({
      ...input,
      name,
    });
  }

  async createItem(
    input: CreateSprintItemInput,
  ): Promise<SprintItemEntity> {
    const sprint = await this.repository.findSprintById(
      input.sprintId,
    );

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const title = input.title.trim();

    if (!title) {
      throw new BadRequestException(
        'Sprint item title is required',
      );
    }

    return this.repository.createItem({
      ...input,
      title,
    });
  }

  async updateItem(
    itemId: string,
    input: UpdateSprintItemInput,
  ): Promise<SprintItemEntity> {
    const item = await this.repository.findItemById(itemId);

    if (!item) {
      throw new NotFoundException('Sprint item not found');
    }

    if (input.title !== undefined) {
      const title = input.title.trim();

      if (!title) {
        throw new BadRequestException(
          'Sprint item title is required',
        );
      }

      item.title = title;
    }

    if (input.description !== undefined) {
      item.description = input.description;
    }

    if (input.ownerWorkspaceMemberId !== undefined) {
      item.ownerWorkspaceMemberId =
        input.ownerWorkspaceMemberId;
    }

    if (input.dueAt !== undefined) {
      item.dueAt = input.dueAt;
    }

    if (input.acceptanceCriteria !== undefined) {
      item.acceptanceCriteria = input.acceptanceCriteria;
    }

    if (input.blockerText !== undefined) {
      item.blockerText = input.blockerText;
    }

    if (input.status !== undefined) {
      item.status = input.status;

      if (
        input.status !== 'blocked' &&
        input.blockerText === undefined
      ) {
        item.blockerText = null;
      }
    }

    if (
      item.status === 'blocked' &&
      !item.blockerText?.trim()
    ) {
      throw new BadRequestException(
        'Blocked sprint item requires blocker text',
      );
    }

    return this.repository.saveItem(item);
  }
}
