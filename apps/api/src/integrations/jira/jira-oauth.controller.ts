import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  ParseUUIDPipe,
  Post,
  Query,
  Redirect,
} from '@nestjs/common';
import { z } from 'zod';

import { AtlassianApiService } from './atlassian-api.service.js';
import { AtlassianConnectionsService } from './atlassian-connections.service.js';
import { AtlassianOAuthStateStore } from './atlassian-oauth-state.store.js';
import { AtlassianOAuthService } from './atlassian-oauth.service.js';

export interface AtlassianOAuthCallbackResult {
  workspaceId: string;
  status: 'authorized';
  cloudId: string;
  siteName: string;
  siteUrl: string;
}

const selectProjectSchema = z.object({
  projectId: z.string().min(1),

  projectKey: z.string().min(1),

  projectName: z.string().min(1),
});

@Controller('integrations/jira')
export class JiraOAuthController {
  public constructor(
    private readonly oauth: AtlassianOAuthService,

    private readonly oauthState: AtlassianOAuthStateStore,

    private readonly connections: AtlassianConnectionsService,

    private readonly atlassianApi: AtlassianApiService,
  ) {}

  @Get('oauth/authorize')
  @Redirect(undefined, HttpStatus.FOUND)
  public async authorize(
    @Query(
      'workspaceId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    workspaceId: string,
  ): Promise<{
    url: string;
  }> {
    const state = await this.oauthState.create(workspaceId);

    return {
      url: this.oauth.createAuthorizationUrl(state),
    };
  }

  @Post('oauth/refresh')
  public async refresh(
    @Query(
      'workspaceId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    workspaceId: string,
  ) {
    const refreshToken = await this.connections.getRefreshToken(workspaceId);

    if (!refreshToken) {
      throw new BadRequestException('Atlassian refresh token is not available');
    }

    const tokens = await this.oauth.refreshAccessToken(refreshToken);

    const accessTokenExpiresAt =
      tokens.expiresIn === null
        ? null
        : new Date(Date.now() + tokens.expiresIn * 1000);

    const connection = await this.connections.replaceTokens({
      workspaceId,

      accessToken: tokens.accessToken,

      refreshToken: tokens.refreshToken,

      accessTokenExpiresAt,

      grantedScopes: tokens.scopes,
    });

    return {
      workspaceId: connection.workspaceId,

      status: connection.status,

      accessTokenExpiresAt: connection.accessTokenExpiresAt,

      refreshTokenRotated: tokens.refreshToken !== null,
    };
  }

  @Get('oauth/callback')
  public async callback(
    @Query('code')
    code?: string,

    @Query('state')
    state?: string,

    @Query('error')
    oauthError?: string,
  ): Promise<AtlassianOAuthCallbackResult> {
    if (oauthError) {
      throw new BadRequestException(
        `Atlassian authorization failed: ${oauthError}`,
      );
    }

    if (!code || code.length === 0) {
      throw new BadRequestException('Atlassian authorization code is missing');
    }

    if (!state || state.length === 0) {
      throw new BadRequestException('Atlassian OAuth state is missing');
    }

    const workspaceId = await this.oauthState.consume(state);

    if (!workspaceId) {
      throw new BadRequestException(
        'Atlassian OAuth state is invalid or expired',
      );
    }

    const tokens = await this.oauth.exchangeCode(code);

    const accessTokenExpiresAt =
      tokens.expiresIn === null
        ? null
        : new Date(Date.now() + tokens.expiresIn * 1000);

    await this.connections.saveTokens({
      workspaceId,

      accessToken: tokens.accessToken,

      refreshToken: tokens.refreshToken,

      accessTokenExpiresAt,

      grantedScopes: tokens.scopes,
    });

    const resources = await this.atlassianApi.getAccessibleResources(
      tokens.accessToken,
    );

    if (resources.length === 0) {
      throw new BadRequestException(
        'No Atlassian Jira site is accessible with this authorization',
      );
    }

    if (resources.length > 1) {
      throw new BadRequestException(
        'Multiple Atlassian sites are accessible; explicit site selection is required',
      );
    }

    const resource = resources[0];

    await this.connections.selectSite({
      workspaceId,

      cloudId: resource.id,

      siteName: resource.name,

      siteUrl: resource.url,
    });

    return {
      workspaceId,

      status: 'authorized',

      cloudId: resource.id,

      siteName: resource.name,

      siteUrl: resource.url,
    };
  }

  @Get('projects')
  public async getProjects(
    @Query(
      'workspaceId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    workspaceId: string,
  ) {
    const connection = await this.connections.requireByWorkspaceId(workspaceId);

    if (!connection.cloudId) {
      throw new BadRequestException('Atlassian site has not been selected');
    }

    const accessToken = await this.connections.getAccessToken(workspaceId);

    return this.atlassianApi.getProjects(accessToken, connection.cloudId);
  }

  @Post('project')
  public async selectProject(
    @Query(
      'workspaceId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    workspaceId: string,

    @Body()
    body: unknown,
  ) {
    const parsed = selectProjectSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(
        'projectId, projectKey and projectName are required',
      );
    }

    const connection = await this.connections.requireByWorkspaceId(workspaceId);

    if (!connection.cloudId) {
      throw new BadRequestException('Atlassian site has not been selected');
    }

    const accessToken = await this.connections.getAccessToken(workspaceId);

    const projects = await this.atlassianApi.getProjects(
      accessToken,
      connection.cloudId,
    );

    const project = projects.find(
      (candidate) =>
        candidate.id === parsed.data.projectId &&
        candidate.key === parsed.data.projectKey,
    );

    if (!project) {
      throw new BadRequestException('Selected Jira project is not accessible');
    }

    const updatedConnection = await this.connections.selectProject({
      workspaceId,

      projectId: project.id,

      projectKey: project.key,

      projectName: project.name,
    });

    return {
      workspaceId: updatedConnection.workspaceId,

      cloudId: updatedConnection.cloudId,

      siteName: updatedConnection.siteName,

      siteUrl: updatedConnection.siteUrl,

      projectId: updatedConnection.projectId,

      projectKey: updatedConnection.projectKey,

      projectName: updatedConnection.projectName,

      status: updatedConnection.status,
    };
  }

  @Get('connection')
  public async verifyConnection(
    @Query(
      'workspaceId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    workspaceId: string,
  ) {
    const connection = await this.connections.requireByWorkspaceId(workspaceId);

    if (
      !connection.cloudId ||
      !connection.projectId ||
      !connection.projectKey
    ) {
      throw new BadRequestException('Jira integration is not fully configured');
    }

    const accessToken = await this.connections.getAccessToken(workspaceId);

    const project = await this.atlassianApi.getProject(
      accessToken,
      connection.cloudId,
      connection.projectKey,
    );

    if (
      project.id !== connection.projectId ||
      project.key !== connection.projectKey
    ) {
      throw new BadRequestException(
        'Configured Jira project no longer matches the accessible project',
      );
    }

    return {
      workspaceId: connection.workspaceId,

      status: 'connected',

      site: {
        cloudId: connection.cloudId,

        name: connection.siteName,

        url: connection.siteUrl,
      },

      project: {
        id: project.id,

        key: project.key,

        name: project.name,
      },
    };
  }
}
