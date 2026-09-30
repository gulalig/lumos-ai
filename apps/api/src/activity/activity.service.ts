import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import { InterventionHistoryService } from '../interventions/intervention-history.service.js';
import { InterventionPublisher } from '../interventions/intervention.publisher.js';
import { JiraIssueMappingEntity } from '../integrations/jira/entities/jira-issue-mapping.entity.js';
import { JiraSyncOutboxEntity } from '../integrations/jira/entities/jira-sync-outbox.entity.js';
import { MeetingsRepository } from '../meetings/meetings.repository.js';
import { SprintItemEntity } from '../sprints/entities/sprint-item.entity.js';

import type { ActivityEntry, ActivityFeed } from './activity.types.js';

import { DataSource } from 'typeorm';

@Injectable()
export class ActivityService {
  public constructor(
    private readonly dataSource: DataSource,

    private readonly meetings: MeetingsRepository,

    private readonly interventionHistory: InterventionHistoryService,

    private readonly interventionPublisher: InterventionPublisher,
  ) {}

  public async getFeed(workspaceId: string): Promise<ActivityFeed> {
    const activities: ActivityEntry[] = [];

    const meetings = await this.meetings.findByWorkspace(workspaceId);

    for (const meeting of meetings) {
      activities.push({
        id: `meeting-created:${meeting.id}`,

        type: 'meeting_created',

        category: 'meeting',

        tone: 'neutral',

        title: 'Meeting added to Lumos',

        description: meeting.roomName,

        occurredAt: meeting.createdAt,

        meetingId: meeting.id,

        sprintItemId: null,

        jiraIssueKey: null,
      });

      if (meeting.startedAt) {
        activities.push({
          id: `meeting-started:${meeting.id}`,

          type: 'meeting_started',

          category: 'meeting',

          tone: 'active',

          title: 'Meeting started',

          description: `${meeting.roomName} is being processed by Lumos.`,

          occurredAt: meeting.startedAt,

          meetingId: meeting.id,

          sprintItemId: null,

          jiraIssueKey: null,
        });
      }

      if (meeting.endedAt) {
        activities.push({
          id: `meeting-ended:${meeting.id}`,

          type: 'meeting_ended',

          category: 'meeting',

          tone: 'success',

          title: 'Meeting completed',

          description: meeting.roomName,

          occurredAt: meeting.endedAt,

          meetingId: meeting.id,

          sprintItemId: null,

          jiraIssueKey: null,
        });
      }

      const history = await this.interventionHistory.listByMeeting(meeting.id);

      for (const entry of history) {
        const intervention = entry.intervention;

        activities.push({
          id: `intervention-requested:${intervention.id}`,

          type: 'intervention_requested',

          category: 'intervention',

          tone: 'warning',

          title:
            intervention.reason === 'missing_owner'
              ? 'Lumos asked for an owner'
              : 'Lumos asked for a due date',

          description: intervention.message,

          occurredAt: intervention.createdAt,

          meetingId: intervention.meetingId,

          sprintItemId: intervention.sprintItemId,

          jiraIssueKey: null,
        });

        const state = await this.interventionPublisher.getGapState(
          meeting.id,
          intervention.gapId,
        );

        if (state?.resolvedAt) {
          activities.push({
            id: `intervention-resolved:${intervention.id}`,

            type: 'intervention_resolved',

            category: 'intervention',

            tone: 'success',

            title:
              intervention.reason === 'missing_owner'
                ? 'Missing owner resolved'
                : 'Missing due date resolved',

            description:
              'The clarification was captured and the execution item was updated.',

            occurredAt: state.resolvedAt,

            meetingId: intervention.meetingId,

            sprintItemId: intervention.sprintItemId,

            jiraIssueKey: null,
          });
        }
      }
    }

    const sprintItems = await this.dataSource
      .getRepository(SprintItemEntity)
      .createQueryBuilder('item')
      .innerJoin('item.sprint', 'sprint')
      .where('sprint.workspace_id = :workspaceId', {
        workspaceId,
      })
      .orderBy('item.created_at', 'DESC')
      .getMany();

    for (const item of sprintItems) {
      activities.push({
        id: `execution-created:${item.id}`,

        type: 'execution_created',

        category: 'execution',

        tone: 'active',

        title: 'Commitment moved to execution',

        description: item.title,

        occurredAt: item.createdAt,

        meetingId: null,

        sprintItemId: item.id,

        jiraIssueKey: null,
      });

      const createdAt = item.createdAt.getTime();

      const updatedAt = item.updatedAt.getTime();

      if (updatedAt - createdAt > 1000) {
        activities.push({
          id: `execution-updated:${item.id}:${updatedAt}`,

          type: 'execution_updated',

          category: 'execution',

          tone:
            item.status === 'done'
              ? 'success'
              : item.status === 'blocked'
                ? 'warning'
                : 'neutral',

          title:
            item.status === 'done'
              ? 'Execution item completed'
              : item.status === 'blocked'
                ? 'Execution item blocked'
                : 'Execution item updated',

          description: item.title,

          occurredAt: item.updatedAt,

          meetingId: null,

          sprintItemId: item.id,

          jiraIssueKey: null,
        });
      }
    }

    const outbox = await this.dataSource
      .getRepository(JiraSyncOutboxEntity)
      .find({
        where: {
          workspaceId,
        },

        order: {
          updatedAt: 'DESC',
        },
      });

    const sprintItemIds = outbox.map((entry) => entry.sprintItemId);

    const mappings =
      sprintItemIds.length > 0
        ? await this.dataSource.getRepository(JiraIssueMappingEntity).find({
            where: {
              sprintItemId: In(sprintItemIds),
            },
          })
        : [];

    const mappingBySprintItem = new Map(
      mappings.map((mapping) => [mapping.sprintItemId, mapping]),
    );

    for (const entry of outbox) {
      const mapping = mappingBySprintItem.get(entry.sprintItemId);

      activities.push({
        id: `jira-queued:${entry.id}`,

        type: 'jira_queued',

        category: 'jira',

        tone: 'neutral',

        title: 'Execution item queued for Jira',

        description: mapping?.jiraIssueKey
          ? `Jira issue ${mapping.jiraIssueKey}`
          : 'Waiting for Jira delivery.',

        occurredAt: entry.createdAt,

        meetingId: null,

        sprintItemId: entry.sprintItemId,

        jiraIssueKey: mapping?.jiraIssueKey ?? null,
      });

      if (entry.lastError) {
        activities.push({
          id: `jira-failed:${entry.id}:${entry.updatedAt.getTime()}`,

          type: 'jira_failed',

          category: 'jira',

          tone: 'error',

          title: 'Jira sync failed',

          description: entry.lastError,

          occurredAt: entry.updatedAt,

          meetingId: null,

          sprintItemId: entry.sprintItemId,

          jiraIssueKey: mapping?.jiraIssueKey ?? null,
        });
      }

      if (mapping?.lastSyncedAt) {
        activities.push({
          id: `jira-synced:${mapping.id}:${mapping.lastSyncedAt.getTime()}`,

          type: 'jira_synced',

          category: 'jira',

          tone: 'success',

          title: 'Execution synced to Jira',

          description: `Issue ${mapping.jiraIssueKey} is up to date.`,

          occurredAt: mapping.lastSyncedAt,

          meetingId: null,

          sprintItemId: entry.sprintItemId,

          jiraIssueKey: mapping.jiraIssueKey,
        });
      }
    }

    activities.sort(
      (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
    );

    return {
      activities,

      summary: {
        total: activities.length,

        meetings: meetings.length,

        resolvedInterventions: activities.filter(
          (activity) => activity.type === 'intervention_resolved',
        ).length,

        jiraSynced: activities.filter(
          (activity) => activity.type === 'jira_synced',
        ).length,
      },
    };
  }
}
