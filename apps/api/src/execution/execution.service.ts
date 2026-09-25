import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { WorkspaceMemberEntity } from '../identity/entities/workspace-member.entity.js';
import { MeetingEntity } from '../meetings/meeting.entity.js';
import { SprintItemEntity } from '../sprints/entities/sprint-item.entity.js';
import { SprintEntity } from '../sprints/entities/sprint.entity.js';

import { ExecutionObservationLinkEntity } from './entities/execution-observation-link.entity.js';
import { JiraSyncOutboxRepository } from '../integrations/jira/jira-sync-outbox.repository.js';

export interface ApplyCommitmentInput {
  meetingId: string;
  ownerDisplayName?: string | null;
  observationId: string;
  evidenceEventId: string;
  summary: string;
  ownerWorkspaceMemberId: string | null;
  dueAt: Date | null;
  supersedesObservationId?: string;
}

@Injectable()
export class ExecutionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jiraSyncOutbox: JiraSyncOutboxRepository,
  ) {}

  async applyCommitment(
    input: ApplyCommitmentInput,
  ): Promise<SprintItemEntity> {
    return this.dataSource.transaction(async (manager) => {
      const links = manager.getRepository(ExecutionObservationLinkEntity);

      const existingLink = await links.findOne({
        where: {
          observationId: input.observationId,
        },
        relations: {
          sprintItem: true,
        },
      });

      // Redis semantic delivery is at-least-once.
      // If this observation was already applied,
      // return the same domain item without mutating it again.
      if (existingLink) {
        return existingLink.sprintItem;
      }

      const meetings = manager.getRepository(MeetingEntity);

      const meeting = await meetings.findOne({
        where: {
          id: input.meetingId,
        },
      });

      if (!meeting) {
        throw new NotFoundException('Meeting not found');
      }

      if (!meeting.workspaceId) {
        throw new ConflictException('Meeting is not bound to a workspace');
      }

      let resolvedOwnerWorkspaceMemberId = input.ownerWorkspaceMemberId;

      if (!resolvedOwnerWorkspaceMemberId && input.ownerDisplayName?.trim()) {
        const members = manager.getRepository(WorkspaceMemberEntity);

        const matches = await members
          .createQueryBuilder('member')
          .innerJoinAndSelect('member.user', 'user')
          .where('member.workspace_id = :workspaceId', {
            workspaceId: meeting.workspaceId,
          })
          .andWhere(
            'LOWER(BTRIM(user.display_name)) = LOWER(BTRIM(:displayName))',
            {
              displayName: input.ownerDisplayName.trim(),
            },
          )
          .take(2)
          .getMany();

        if (matches.length === 1) {
          resolvedOwnerWorkspaceMemberId = matches[0].id;
        }
      }

      if (resolvedOwnerWorkspaceMemberId) {
        const members = manager.getRepository(WorkspaceMemberEntity);

        const owner = await members.findOne({
          where: {
            id: resolvedOwnerWorkspaceMemberId,
            workspaceId: meeting.workspaceId,
          },
        });

        if (!owner) {
          throw new ConflictException(
            'Commitment owner does not belong to the meeting workspace',
          );
        }
      }

      const items = manager.getRepository(SprintItemEntity);

      let item: SprintItemEntity;

      if (input.supersedesObservationId) {
        const previousLink = await links.findOne({
          where: {
            observationId: input.supersedesObservationId,
          },
        });

        if (!previousLink) {
          throw new ConflictException(
            'Superseded observation has no execution-state link',
          );
        }

        const existingItem = await items.findOne({
          where: {
            id: previousLink.sprintItemId,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!existingItem) {
          throw new ConflictException('Linked sprint item no longer exists');
        }

        // IMPORTANT:
        // refinement mutates the SAME execution item.
        existingItem.title = input.summary;

        if (resolvedOwnerWorkspaceMemberId !== null) {
          existingItem.ownerWorkspaceMemberId = resolvedOwnerWorkspaceMemberId;
        }

        if (input.dueAt !== null) {
          existingItem.dueAt = input.dueAt;
        }

        item = await items.save(existingItem);
      } else {
        const sprints = manager.getRepository(SprintEntity);

        const activeSprint = await sprints.findOne({
          where: {
            workspaceId: meeting.workspaceId,
            status: 'active',
          },
          order: {
            startsAt: 'DESC',
            createdAt: 'DESC',
          },
        });

        if (!activeSprint) {
          throw new ConflictException('Workspace has no active sprint');
        }

        item = items.create({
          id: randomUUID(),
          sprintId: activeSprint.id,
          title: input.summary,
          description: null,
          status: 'todo',
          ownerWorkspaceMemberId: resolvedOwnerWorkspaceMemberId,
          dueAt: input.dueAt,
          blockerText: null,
          acceptanceCriteria: [],
        });

        item = await items.save(item);
      }

      const link = links.create({
        observationId: input.observationId,
        meetingId: input.meetingId,
        sprintItemId: item.id,
        kind: 'commitment',
        evidenceEventId: input.evidenceEventId,
      });

      await links.save(link);

      await this.jiraSyncOutbox.enqueue(meeting.workspaceId, item.id, manager);

      return item;
    });
  }
}
