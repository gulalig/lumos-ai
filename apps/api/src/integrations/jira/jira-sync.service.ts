import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { SprintItemEntity } from '../../sprints/entities/sprint-item.entity.js';
import { SprintEntity } from '../../sprints/entities/sprint.entity.js';

import {
  AtlassianApiError,
  AtlassianApiService,
} from './atlassian-api.service.js';
import { AtlassianConnectionsService } from './atlassian-connections.service.js';
import { JiraIssueMappingsRepository } from './jira-issue-mappings.repository.js';
import { AtlassianAccessTokenService } from './atlassian-access-token.service.js';

export interface JiraSyncItemInput {
  workspaceId: string;
  sprintItemId: string;
}

@Injectable()
export class JiraSyncService {
  public constructor(
    private readonly dataSource: DataSource,

    private readonly connections: AtlassianConnectionsService,
    private readonly accessTokens: AtlassianAccessTokenService,

    private readonly atlassianApi: AtlassianApiService,

    private readonly issueMappings: JiraIssueMappingsRepository,
  ) {}

  public async syncItem(input: JiraSyncItemInput): Promise<void> {
    const connection = await this.connections.requireByWorkspaceId(
      input.workspaceId,
    );

    if (
      connection.status !== 'connected' ||
      !connection.cloudId ||
      !connection.projectId ||
      !connection.projectKey
    ) {
      throw new ConflictException('Jira integration is not fully configured');
    }

    const cloudId = connection.cloudId;
    const projectId = connection.projectId;
    const projectKey = connection.projectKey;

    const item = await this.dataSource.getRepository(SprintItemEntity).findOne({
      where: {
        id: input.sprintItemId,
      },
    });

    if (!item) {
      throw new NotFoundException('Sprint item not found');
    }

    const sprint = await this.dataSource.getRepository(SprintEntity).findOne({
      where: {
        id: item.sprintId,
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    if (sprint.workspaceId !== input.workspaceId) {
      throw new ConflictException(
        'Sprint item does not belong to the Jira workspace',
      );
    }

    let accessToken = await this.accessTokens.getValidAccessToken(
      input.workspaceId,
    );

    const withAuthRetry = async <T>(
      operation: (token: string) => Promise<T>,
    ): Promise<T> => {
      try {
        return await operation(accessToken);
      } catch (error) {
        if (
          !(error instanceof AtlassianApiError) ||
          error.upstreamStatus !== 401
        ) {
          throw error;
        }

        accessToken = await this.accessTokens.refreshAfterUnauthorized(
          input.workspaceId,
          accessToken,
        );

        return operation(accessToken);
      }
    };

    const mapping = await this.issueMappings.findBySprintItemId(item.id);

    if (mapping) {
      if (mapping.jiraCloudId !== cloudId) {
        throw new ConflictException(
          'Jira issue mapping belongs to another Jira site',
        );
      }

      await withAuthRetry((token) =>
        this.atlassianApi.updateIssue(token, cloudId, mapping.jiraIssueId, {
          summary: item.title,

          description: this.buildDescription(item),

          dueAt: item.dueAt,
        }),
      );

      await this.issueMappings.markSynced(mapping);

      return;
    }

    const recoveredIssue = await withAuthRetry((token) =>
      this.atlassianApi.findIssueByLumosSprintItemId(
        token,
        cloudId,
        projectKey,
        input.workspaceId,
        item.id,
      ),
    );

    if (recoveredIssue) {
      await this.issueMappings.createMapping({
        sprintItemId: item.id,

        jiraCloudId: cloudId,

        jiraIssueId: recoveredIssue.id,

        jiraIssueKey: recoveredIssue.key,
      });

      return;
    }

    const issueTypes = await withAuthRetry((token) =>
      this.atlassianApi.getProjectIssueTypes(token, cloudId, projectId),
    );

    const issueType = this.selectIssueType(issueTypes);

    const jiraIssue = await withAuthRetry((token) =>
      this.atlassianApi.createIssue(token, cloudId, {
        projectKey,

        issueTypeId: issueType.id,

        summary: item.title,

        description: this.buildDescription(item),

        dueAt: item.dueAt,

        lumosSync: {
          workspaceId: input.workspaceId,

          sprintItemId: item.id,
        },
      }),
    );

    await this.issueMappings.createMapping({
      sprintItemId: item.id,

      jiraCloudId: connection.cloudId,

      jiraIssueId: jiraIssue.id,

      jiraIssueKey: jiraIssue.key,
    });
  }

  private selectIssueType(
    issueTypes: Array<{
      id: string;
      name: string;
      subtask: boolean;
    }>,
  ): {
    id: string;
    name: string;
    subtask: boolean;
  } {
    const standardTypes = issueTypes.filter((issueType) => !issueType.subtask);

    if (standardTypes.length === 0) {
      throw new ConflictException('Jira project has no non-subtask issue type');
    }

    const preferredNames = ['task', 'story'];

    for (const preferredName of preferredNames) {
      const match = standardTypes.find(
        (issueType) => issueType.name.trim().toLowerCase() === preferredName,
      );

      if (match) {
        return match;
      }
    }

    return standardTypes[0];
  }

  private buildDescription(item: SprintItemEntity): string | null {
    const sections: string[] = [];

    if (item.description?.trim()) {
      sections.push(item.description.trim());
    }

    if (item.acceptanceCriteria.length > 0) {
      sections.push(
        [
          'Acceptance criteria:',
          ...item.acceptanceCriteria.map(
            (criterion, index) => `${index + 1}. ${criterion}`,
          ),
        ].join('\n'),
      );
    }

    if (item.blockerText?.trim()) {
      sections.push(`Blocker: ${item.blockerText.trim()}`);
    }

    if (sections.length === 0) {
      return null;
    }

    return sections.join('\n\n');
  }
}
