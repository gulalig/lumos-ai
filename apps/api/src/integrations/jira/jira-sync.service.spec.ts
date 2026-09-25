import { describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { SprintItemEntity } from '../../sprints/entities/sprint-item.entity.js';
import { SprintEntity } from '../../sprints/entities/sprint.entity.js';

import {
  AtlassianApiError,
  AtlassianApiService,
} from './atlassian-api.service.js';
import { AtlassianAccessTokenService } from './atlassian-access-token.service.js';
import { AtlassianConnectionsService } from './atlassian-connections.service.js';
import { AtlassianConnectionEntity } from './entities/atlassian-connection.entity.js';
import { JiraIssueMappingsRepository } from './jira-issue-mappings.repository.js';
import { JiraSyncService } from './jira-sync.service.js';

function createFixture() {
  const item = Object.assign(new SprintItemEntity(), {
    id: 'item-1',
    sprintId: 'sprint-1',

    title: 'Ship Lumos',
    description: null,

    status: 'todo' as const,

    ownerWorkspaceMemberId: null,

    dueAt: null,

    blockerText: null,

    acceptanceCriteria: [],
  });

  const sprint = Object.assign(new SprintEntity(), {
    id: 'sprint-1',

    workspaceId: 'workspace-1',
  });

  const itemRepository = {
    findOne: vi.fn(async () => item),
  };

  const sprintRepository = {
    findOne: vi.fn(async () => sprint),
  };

  const dataSource = {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === SprintItemEntity) {
        return itemRepository;
      }

      if (entity === SprintEntity) {
        return sprintRepository;
      }

      throw new Error('Unexpected repository');
    }),
  } as unknown as DataSource;

  const connection = Object.assign(new AtlassianConnectionEntity(), {
    id: 'connection-1',

    workspaceId: 'workspace-1',

    cloudId: 'cloud-1',

    projectId: '10000',

    projectKey: 'LUM',

    projectName: 'Lumos',

    status: 'connected' as const,
  });

  const connections = {
    requireByWorkspaceId: vi.fn(async () => connection),
  } as unknown as AtlassianConnectionsService;

  const accessTokens = {
    getValidAccessToken: vi.fn(async () => 'access-old'),

    refreshAfterUnauthorized: vi.fn(async () => 'access-new'),
  } as unknown as AtlassianAccessTokenService;

  const atlassianApi = {
    updateIssue: vi.fn(),

    findIssueByLumosSprintItemId: vi.fn(),

    getProjectIssueTypes: vi.fn(),

    createIssue: vi.fn(),
  } as unknown as AtlassianApiService;

  const issueMappings = {
    findBySprintItemId: vi.fn(),

    markSynced: vi.fn(),

    createMapping: vi.fn(),
  } as unknown as JiraIssueMappingsRepository;

  const service = new JiraSyncService(
    dataSource,
    connections,
    accessTokens,
    atlassianApi,
    issueMappings,
  );

  return {
    service,

    item,
    sprint,
    connection,

    dataSource,

    connections,
    accessTokens,

    atlassianApi,
    issueMappings,
  };
}

describe('JiraSyncService', () => {
  it('updates an already mapped Jira issue', async () => {
    const fixture = createFixture();

    const mapping = {
      id: 'mapping-1',

      sprintItemId: 'item-1',

      jiraCloudId: 'cloud-1',

      jiraIssueId: '10001',

      jiraIssueKey: 'LUM-1',

      lastSyncedAt: null,
    };

    vi.mocked(fixture.issueMappings.findBySprintItemId).mockResolvedValue(
      mapping as never,
    );

    vi.mocked(fixture.atlassianApi.updateIssue).mockResolvedValue();

    await fixture.service.syncItem({
      workspaceId: 'workspace-1',

      sprintItemId: 'item-1',
    });

    expect(fixture.atlassianApi.updateIssue).toHaveBeenCalledWith(
      'access-old',
      'cloud-1',
      '10001',
      {
        summary: 'Ship Lumos',

        description: null,

        dueAt: null,
      },
    );

    expect(fixture.issueMappings.markSynced).toHaveBeenCalledWith(mapping);

    expect(fixture.atlassianApi.createIssue).not.toHaveBeenCalled();
  });

  it('refreshes once after Jira returns 401 and retries with the new token', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.issueMappings.findBySprintItemId).mockResolvedValue({
      id: 'mapping-1',

      sprintItemId: 'item-1',

      jiraCloudId: 'cloud-1',

      jiraIssueId: '10001',

      jiraIssueKey: 'LUM-1',

      lastSyncedAt: null,
    } as never);

    vi.mocked(fixture.atlassianApi.updateIssue)
      .mockRejectedValueOnce(new AtlassianApiError('unauthorized', 401))
      .mockResolvedValueOnce();

    await fixture.service.syncItem({
      workspaceId: 'workspace-1',

      sprintItemId: 'item-1',
    });

    expect(fixture.accessTokens.refreshAfterUnauthorized).toHaveBeenCalledWith(
      'workspace-1',
      'access-old',
    );

    expect(fixture.atlassianApi.updateIssue).toHaveBeenNthCalledWith(
      1,
      'access-old',
      'cloud-1',
      '10001',
      expect.any(Object),
    );

    expect(fixture.atlassianApi.updateIssue).toHaveBeenNthCalledWith(
      2,
      'access-new',
      'cloud-1',
      '10001',
      expect.any(Object),
    );
  });

  it('recovers an existing Jira issue when the local mapping is missing', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.issueMappings.findBySprintItemId).mockResolvedValue(null);

    vi.mocked(
      fixture.atlassianApi.findIssueByLumosSprintItemId,
    ).mockResolvedValue({
      id: '10005',
      key: 'LUM-5',
    });

    await fixture.service.syncItem({
      workspaceId: 'workspace-1',

      sprintItemId: 'item-1',
    });

    expect(fixture.issueMappings.createMapping).toHaveBeenCalledWith({
      sprintItemId: 'item-1',

      jiraCloudId: 'cloud-1',

      jiraIssueId: '10005',

      jiraIssueKey: 'LUM-5',
    });

    expect(fixture.atlassianApi.getProjectIssueTypes).not.toHaveBeenCalled();

    expect(fixture.atlassianApi.createIssue).not.toHaveBeenCalled();
  });

  it('creates a Jira issue with deterministic Lumos sync metadata', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.issueMappings.findBySprintItemId).mockResolvedValue(null);

    vi.mocked(
      fixture.atlassianApi.findIssueByLumosSprintItemId,
    ).mockResolvedValue(null);

    vi.mocked(fixture.atlassianApi.getProjectIssueTypes).mockResolvedValue([
      {
        id: '10010',

        name: 'Task',

        subtask: false,
      },
    ]);

    vi.mocked(fixture.atlassianApi.createIssue).mockResolvedValue({
      id: '10020',

      key: 'LUM-20',
    });

    await fixture.service.syncItem({
      workspaceId: 'workspace-1',

      sprintItemId: 'item-1',
    });

    expect(fixture.atlassianApi.createIssue).toHaveBeenCalledWith(
      'access-old',
      'cloud-1',
      {
        projectKey: 'LUM',

        issueTypeId: '10010',

        summary: 'Ship Lumos',

        description: null,

        dueAt: null,

        lumosSync: {
          workspaceId: 'workspace-1',

          sprintItemId: 'item-1',
        },
      },
    );

    expect(fixture.issueMappings.createMapping).toHaveBeenCalledWith({
      sprintItemId: 'item-1',

      jiraCloudId: 'cloud-1',

      jiraIssueId: '10020',

      jiraIssueKey: 'LUM-20',
    });
  });
});
