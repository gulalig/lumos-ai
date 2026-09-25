import { BadGatewayException, Injectable } from '@nestjs/common';

export class AtlassianApiError extends BadGatewayException {
  public constructor(
    message: string,
    public readonly upstreamStatus: number,
  ) {
    super(message);
  }
}

export interface AtlassianAccessibleResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

interface AtlassianAccessibleResourceResponse {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  scopes?: unknown;
}

interface JiraProjectResponse {
  id?: unknown;
  key?: unknown;
  name?: unknown;
}

interface JiraProjectSearchResponse {
  values?: unknown;
}

export interface JiraProjectDetails {
  id: string;
  key: string;
  name: string;
}

export interface JiraRecoveredIssue {
  id: string;
  key: string;
}

interface JiraSearchIssueResponse {
  id?: unknown;
  key?: unknown;
  properties?: unknown;
}

interface JiraSearchResponse {
  issues?: unknown;
  nextPageToken?: unknown;
}

export interface JiraIssueCreateInput {
  projectKey: string;
  issueTypeId: string;
  summary: string;
  description: string | null;
  dueAt: Date | null;

  lumosSync: {
    workspaceId: string;
    sprintItemId: string;
  };
}

export interface JiraIssueUpdateInput {
  summary: string;
  description: string | null;
  dueAt: Date | null;
}

export interface JiraIssueResult {
  id: string;
  key: string;
}

const accessibleResourcesUrl =
  'https://api.atlassian.com/oauth/token/accessible-resources';

const lumosSyncPropertyKey = 'lumos.sync';

@Injectable()
export class AtlassianApiService {
  public async getAccessibleResources(
    accessToken: string,
  ): Promise<AtlassianAccessibleResource[]> {
    const response = await fetch(accessibleResourcesUrl, {
      method: 'GET',

      headers: {
        Authorization: `Bearer ${accessToken}`,

        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new AtlassianApiError(
        `Atlassian accessible-resources request failed with HTTP ${response.status}`,
        response.status,
      );
    }

    const body = await response.json();

    if (!Array.isArray(body)) {
      throw new BadGatewayException(
        'Atlassian accessible-resources response was not an array',
      );
    }

    return body.map((value: AtlassianAccessibleResourceResponse) => {
      if (
        typeof value.id !== 'string' ||
        value.id.length === 0 ||
        typeof value.name !== 'string' ||
        value.name.length === 0 ||
        typeof value.url !== 'string' ||
        value.url.length === 0 ||
        !Array.isArray(value.scopes)
      ) {
        throw new BadGatewayException(
          'Atlassian accessible-resources response contained an invalid resource',
        );
      }

      const scopes = value.scopes.filter(
        (scope): scope is string => typeof scope === 'string',
      );

      return {
        id: value.id,
        name: value.name,
        url: value.url,
        scopes,
      };
    });
  }

  public async getProjects(
    accessToken: string,
    cloudId: string,
  ): Promise<JiraProject[]> {
    const url = new URL(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(
        cloudId,
      )}/rest/api/3/project/search`,
    );

    url.searchParams.set('maxResults', '100');

    url.searchParams.set('orderBy', 'name');

    const response = await fetch(url, {
      method: 'GET',

      headers: {
        Authorization: `Bearer ${accessToken}`,

        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new AtlassianApiError(
        `Jira project discovery failed with HTTP ${response.status}`,
        response.status,
      );
    }

    const body = (await response.json()) as JiraProjectSearchResponse;

    if (!Array.isArray(body.values)) {
      throw new BadGatewayException(
        'Jira project search response did not include a valid values array',
      );
    }

    return body.values.map((value: JiraProjectResponse) => {
      if (
        typeof value.id !== 'string' ||
        value.id.length === 0 ||
        typeof value.key !== 'string' ||
        value.key.length === 0 ||
        typeof value.name !== 'string' ||
        value.name.length === 0
      ) {
        throw new BadGatewayException(
          'Jira project search response contained an invalid project',
        );
      }

      return {
        id: value.id,
        key: value.key,
        name: value.name,
      };
    });
  }

  public async getProject(
    accessToken: string,
    cloudId: string,
    projectIdOrKey: string,
  ): Promise<JiraProjectDetails> {
    const url = `https://api.atlassian.com/ex/jira/${encodeURIComponent(
      cloudId,
    )}/rest/api/3/project/${encodeURIComponent(projectIdOrKey)}`;

    const response = await fetch(url, {
      method: 'GET',

      headers: {
        Authorization: `Bearer ${accessToken}`,

        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new AtlassianApiError(
        `Jira project verification failed with HTTP ${response.status}`,
        response.status,
      );
    }

    const body = (await response.json()) as {
      id?: unknown;
      key?: unknown;
      name?: unknown;
    };

    if (
      typeof body.id !== 'string' ||
      body.id.length === 0 ||
      typeof body.key !== 'string' ||
      body.key.length === 0 ||
      typeof body.name !== 'string' ||
      body.name.length === 0
    ) {
      throw new BadGatewayException(
        'Jira project verification response was invalid',
      );
    }

    return {
      id: body.id,

      key: body.key,

      name: body.name,
    };
  }

  public async getProjectIssueTypes(
    accessToken: string,
    cloudId: string,
    projectId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      subtask: boolean;
    }>
  > {
    const url = new URL(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(
        cloudId,
      )}/rest/api/3/issuetype/project`,
    );

    url.searchParams.set('projectId', projectId);

    const response = await fetch(url, {
      method: 'GET',

      headers: {
        Authorization: `Bearer ${accessToken}`,

        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new AtlassianApiError(
        `Jira issue type discovery failed with HTTP ${response.status}`,
        response.status,
      );
    }

    const body = await response.json();

    if (!Array.isArray(body)) {
      throw new BadGatewayException('Jira issue type response was invalid');
    }

    return body.map((value: unknown) => {
      if (typeof value !== 'object' || value === null) {
        throw new BadGatewayException(
          'Jira issue type response contained an invalid item',
        );
      }

      const candidate = value as {
        id?: unknown;
        name?: unknown;
        subtask?: unknown;
      };

      if (
        typeof candidate.id !== 'string' ||
        candidate.id.length === 0 ||
        typeof candidate.name !== 'string' ||
        candidate.name.length === 0
      ) {
        throw new BadGatewayException(
          'Jira issue type response contained an invalid issue type',
        );
      }

      return {
        id: candidate.id,

        name: candidate.name,

        subtask: candidate.subtask === true,
      };
    });
  }

  public async createIssue(
    accessToken: string,
    cloudId: string,
    input: JiraIssueCreateInput,
  ): Promise<JiraIssueResult> {
    const url = `https://api.atlassian.com/ex/jira/${encodeURIComponent(
      cloudId,
    )}/rest/api/3/issue`;

    const response = await fetch(url, {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${accessToken}`,

        Accept: 'application/json',

        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        fields: {
          project: {
            key: input.projectKey,
          },

          issuetype: {
            id: input.issueTypeId,
          },

          summary: input.summary,

          description: this.toAtlassianDocument(input.description),

          duedate: this.toJiraDate(input.dueAt),
        },

        properties: [
          {
            key: lumosSyncPropertyKey,

            value: {
              workspaceId: input.lumosSync.workspaceId,

              sprintItemId: input.lumosSync.sprintItemId,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new AtlassianApiError(
        `Jira issue creation failed with HTTP ${response.status}`,
        response.status,
      );
    }

    const body = (await response.json()) as {
      id?: unknown;
      key?: unknown;
    };

    if (
      typeof body.id !== 'string' ||
      body.id.length === 0 ||
      typeof body.key !== 'string' ||
      body.key.length === 0
    ) {
      throw new BadGatewayException('Jira issue creation response was invalid');
    }

    return {
      id: body.id,

      key: body.key,
    };
  }

  public async findIssueByLumosSprintItemId(
    accessToken: string,
    cloudId: string,
    projectKey: string,
    workspaceId: string,
    sprintItemId: string,
  ): Promise<JiraRecoveredIssue | null> {
    let nextPageToken: string | null = null;

    do {
      const url = `https://api.atlassian.com/ex/jira/${encodeURIComponent(
        cloudId,
      )}/rest/api/3/search/jql`;

      const response = await fetch(url, {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${accessToken}`,

          Accept: 'application/json',

          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          jql: `project = "${this.escapeJqlValue(
            projectKey,
          )}" ORDER BY created DESC`,

          maxResults: 100,

          fields: [],

          properties: [lumosSyncPropertyKey],

          ...(nextPageToken
            ? {
                nextPageToken,
              }
            : {}),
        }),
      });

      if (!response.ok) {
        throw new AtlassianApiError(
          `Jira Lumos issue recovery search failed with HTTP ${response.status}`,
          response.status,
        );
      }

      const body = (await response.json()) as JiraSearchResponse;

      if (!Array.isArray(body.issues)) {
        throw new BadGatewayException(
          'Jira issue recovery search response was invalid',
        );
      }

      for (const value of body.issues) {
        if (typeof value !== 'object' || value === null) {
          continue;
        }

        const issue = value as JiraSearchIssueResponse;

        if (
          typeof issue.id !== 'string' ||
          issue.id.length === 0 ||
          typeof issue.key !== 'string' ||
          issue.key.length === 0
        ) {
          continue;
        }

        if (typeof issue.properties !== 'object' || issue.properties === null) {
          continue;
        }

        const properties = issue.properties as Record<string, unknown>;

        const lumosSync = properties[lumosSyncPropertyKey];

        if (typeof lumosSync !== 'object' || lumosSync === null) {
          continue;
        }

        const sync = lumosSync as {
          workspaceId?: unknown;
          sprintItemId?: unknown;
        };

        if (
          sync.workspaceId === workspaceId &&
          sync.sprintItemId === sprintItemId
        ) {
          return {
            id: issue.id,
            key: issue.key,
          };
        }
      }

      nextPageToken =
        typeof body.nextPageToken === 'string' && body.nextPageToken.length > 0
          ? body.nextPageToken
          : null;
    } while (nextPageToken);

    return null;
  }

  public async updateIssue(
    accessToken: string,
    cloudId: string,
    issueIdOrKey: string,
    input: JiraIssueUpdateInput,
  ): Promise<void> {
    const url = `https://api.atlassian.com/ex/jira/${encodeURIComponent(
      cloudId,
    )}/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}`;

    const response = await fetch(url, {
      method: 'PUT',

      headers: {
        Authorization: `Bearer ${accessToken}`,

        Accept: 'application/json',

        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        fields: {
          summary: input.summary,

          description: this.toAtlassianDocument(input.description),

          duedate: this.toJiraDate(input.dueAt),
        },
      }),
    });

    if (!response.ok) {
      throw new AtlassianApiError(
        `Jira issue update failed with HTTP ${response.status}`,
        response.status,
      );
    }
  }

  private escapeJqlValue(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  }

  private toAtlassianDocument(value: string | null): {
    version: 1;
    type: 'doc';
    content: Array<{
      type: 'paragraph';
      content: Array<{
        type: 'text';
        text: string;
      }>;
    }>;
  } | null {
    if (value === null || value.trim().length === 0) {
      return null;
    }

    return {
      version: 1,
      type: 'doc',

      content: [
        {
          type: 'paragraph',

          content: [
            {
              type: 'text',
              text: value,
            },
          ],
        },
      ],
    };
  }

  private toJiraDate(value: Date | null): string | null {
    if (!value) {
      return null;
    }

    return value.toISOString().slice(0, 10);
  }
}
