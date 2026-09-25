import { BadGatewayException, Injectable } from '@nestjs/common';

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

const accessibleResourcesUrl =
  'https://api.atlassian.com/oauth/token/accessible-resources';

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
      throw new BadGatewayException(
        `Atlassian accessible-resources request failed with HTTP ${response.status}`,
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
      throw new BadGatewayException(
        `Jira project discovery failed with HTTP ${response.status}`,
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
      throw new BadGatewayException(
        `Jira project verification failed with HTTP ${response.status}`,
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
}
