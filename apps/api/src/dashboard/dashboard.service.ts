import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { MeetingsRepository } from '../meetings/meetings.repository.js';
import { SprintsRepository } from '../sprints/sprints.repository.js';

import { InterventionHistoryService } from '../interventions/intervention-history.service.js';
import { InterventionPublisher } from '../interventions/intervention.publisher.js';

import { JiraIssueMappingEntity } from '../integrations/jira/entities/jira-issue-mapping.entity.js';
import { JiraSyncOutboxEntity } from '../integrations/jira/entities/jira-sync-outbox.entity.js';

import type {
  DashboardExecutionItem,
  DashboardIntervention,
  DashboardJiraState,
  DashboardOverview,
} from './dashboard.types.js';

@Injectable()
export class DashboardService {
  public constructor(
    private readonly meetings: MeetingsRepository,

    private readonly sprints: SprintsRepository,

    private readonly interventionHistory: InterventionHistoryService,

    private readonly interventionPublisher: InterventionPublisher,

    private readonly dataSource: DataSource,
  ) {}

  public async getOverview(workspaceId: string): Promise<DashboardOverview> {
    const activeSprint = await this.sprints.findActiveByWorkspace(workspaceId);

    const sprintItems = activeSprint
      ? await this.sprints.findItemsBySprintForWorkspace(
          activeSprint.id,
          workspaceId,
        )
      : [];

    const recentMeetings = await this.meetings.findRecentByWorkspace(
      workspaceId,
      5,
    );

    const executionItems = await Promise.all(
      sprintItems.map(async (item): Promise<DashboardExecutionItem> => {
        const jira = await this.getJiraState(item.id);

        return {
          id: item.id,

          title: item.title,

          description: item.description,

          status: item.status,

          ownerWorkspaceMemberId: item.ownerWorkspaceMemberId,

          dueAt: item.dueAt,

          blockerText: item.blockerText,

          acceptanceCriteria: item.acceptanceCriteria,

          missingOwner: item.ownerWorkspaceMemberId === null,

          missingDueDate: item.dueAt === null,

          jira,

          createdAt: item.createdAt,

          updatedAt: item.updatedAt,
        };
      }),
    );

    const recentInterventions: DashboardIntervention[] = [];

    for (const meeting of recentMeetings) {
      const history = await this.interventionHistory.listByMeeting(meeting.id);

      for (const entry of history) {
        const intervention = entry.intervention;

        const state = await this.interventionPublisher.getGapState(
          meeting.id,
          intervention.gapId,
        );

        recentInterventions.push({
          id: intervention.id,

          gapId: intervention.gapId,

          meetingId: intervention.meetingId,

          sprintItemId: intervention.sprintItemId,

          observationId: intervention.observationId,

          reason: intervention.reason,

          message: intervention.message,

          createdAt: intervention.createdAt,

          resolved: state?.resolvedAt !== null && state !== null,

          resolvedAt: state?.resolvedAt ?? null,
        });
      }
    }

    recentInterventions.sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );

    const needsAttention = executionItems.filter(
      (item) =>
        item.missingOwner ||
        item.missingDueDate ||
        item.status === 'blocked' ||
        item.jira.status === 'error',
    ).length;

    const resolvedInterventions = recentInterventions.filter(
      (intervention) => intervention.resolved,
    ).length;

    const completedItems = executionItems.filter(
      (item) => item.status === 'done',
    ).length;

    return {
      summary: {
        executionItems: executionItems.length,

        needsAttention,

        resolvedInterventions,

        completedItems,
      },

      activeSprint: activeSprint
        ? {
            id: activeSprint.id,

            name: activeSprint.name,

            goal: activeSprint.goal,

            status: activeSprint.status,

            startsAt: activeSprint.startsAt,

            endsAt: activeSprint.endsAt,
          }
        : null,

      executionItems,

      recentMeetings: recentMeetings.map((meeting) => ({
        id: meeting.id,

        roomName: meeting.roomName,

        status: meeting.status,

        createdAt: meeting.createdAt,

        startedAt: meeting.startedAt,

        endedAt: meeting.endedAt,
      })),

      recentInterventions: recentInterventions.slice(0, 10),
    };
  }

  private async getJiraState(
    sprintItemId: string,
  ): Promise<DashboardJiraState> {
    const mappingRepository = this.dataSource.getRepository(
      JiraIssueMappingEntity,
    );

    const outboxRepository =
      this.dataSource.getRepository(JiraSyncOutboxEntity);

    const [mapping, outbox] = await Promise.all([
      mappingRepository.findOne({
        where: {
          sprintItemId,
        },
      }),

      outboxRepository.findOne({
        where: {
          sprintItemId,
        },
      }),
    ]);

    if (outbox?.lastError) {
      return {
        status: 'error',

        issueKey: mapping?.jiraIssueKey ?? null,

        issueId: mapping?.jiraIssueId ?? null,

        lastSyncedAt: mapping?.lastSyncedAt ?? null,

        lastError: outbox.lastError,
      };
    }

    if (outbox?.status === 'processing') {
      return {
        status: 'processing',

        issueKey: mapping?.jiraIssueKey ?? null,

        issueId: mapping?.jiraIssueId ?? null,

        lastSyncedAt: mapping?.lastSyncedAt ?? null,

        lastError: null,
      };
    }

    if (outbox?.status === 'pending') {
      return {
        status: 'pending',

        issueKey: mapping?.jiraIssueKey ?? null,

        issueId: mapping?.jiraIssueId ?? null,

        lastSyncedAt: mapping?.lastSyncedAt ?? null,

        lastError: null,
      };
    }

    if (mapping) {
      return {
        status: 'synced',

        issueKey: mapping.jiraIssueKey,

        issueId: mapping.jiraIssueId,

        lastSyncedAt: mapping.lastSyncedAt,

        lastError: null,
      };
    }

    return {
      status: 'not_synced',

      issueKey: null,

      issueId: null,

      lastSyncedAt: null,

      lastError: null,
    };
  }
}
