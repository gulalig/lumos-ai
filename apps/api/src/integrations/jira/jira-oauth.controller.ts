import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { jiraBrowserRedirect } from '../../config/production.js';

import type { AuthPrincipal } from '../../auth/auth-principal.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { RolesGuard } from '../../auth/roles.guard.js';

import { AtlassianApiService } from './atlassian-api.service.js';
import { AtlassianConnectionsService } from './atlassian-connections.service.js';
import { AtlassianOAuthStateStore } from './atlassian-oauth-state.store.js';
import { AtlassianOAuthService } from './atlassian-oauth.service.js';

export type JiraSetupState =
  | 'authorization_required'
  | 'site_selection_required'
  | 'project_selection_required'
  | 'connected';

const selectSiteSchema = z.object({
  cloudId: z.string().min(1),
});

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
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('setup')
  @UseGuards(JwtAuthGuard)
  public async getSetupState(
    @CurrentUser()
    principal: AuthPrincipal,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    const connection = await this.connections.getByWorkspaceId(workspaceId);

    if (!connection) {
      return {
        workspaceId,

        state: 'authorization_required' as const,

        status: 'not_configured' as const,

        site: null,

        project: null,

        lastError: null,
      };
    }

    const state = this.resolveSetupState(
      connection.cloudId,

      connection.projectId,

      connection.projectKey,
    );

    return {
      workspaceId,

      state,

      status: connection.status,

      site: connection.cloudId
        ? {
            cloudId: connection.cloudId,

            name: connection.siteName,

            url: connection.siteUrl,
          }
        : null,

      project:
        connection.projectId && connection.projectKey
          ? {
              id: connection.projectId,

              key: connection.projectKey,

              name: connection.projectName,
            }
          : null,

      lastError: connection.lastError,
    };
  }

  @Get('oauth/authorize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  public async authorize(
    @CurrentUser()
    principal: AuthPrincipal,
  ): Promise<{
    url: string;
  }> {
    const workspaceId = this.requireWorkspaceId(principal);

    const state = await this.oauthState.create(workspaceId);

    return {
      url: this.oauth.createAuthorizationUrl(state),
    };
  }

  @Post('oauth/refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  public async refresh(
    @CurrentUser()
    principal: AuthPrincipal,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

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
  @Redirect('', HttpStatus.FOUND)
  public async callback(
    @Query('code')
    code?: string,

    @Query('state')
    state?: string,

    @Query('error')
    oauthError?: string,
  ): Promise<{ url: string }> {
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
      return {
        url: jiraBrowserRedirect(
          this.config.get('WEB_ORIGIN', { infer: true }),
        ),
      };
    }

    const resource = resources[0];

    await this.connections.selectSite({
      workspaceId,

      cloudId: resource.id,

      siteName: resource.name,

      siteUrl: resource.url,
    });

    return {
      url: jiraBrowserRedirect(this.config.get('WEB_ORIGIN', { infer: true })),
    };
  }

  @Get('sites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  public async getSites(
    @CurrentUser()
    principal: AuthPrincipal,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    await this.connections.requireByWorkspaceId(workspaceId);

    const accessToken = await this.connections.getAccessToken(workspaceId);

    return this.atlassianApi.getAccessibleResources(accessToken);
  }

  @Post('site')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  public async selectSite(
    @CurrentUser()
    principal: AuthPrincipal,

    @Body()
    body: unknown,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    const parsed = selectSiteSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException('cloudId is required');
    }

    await this.connections.requireByWorkspaceId(workspaceId);

    const accessToken = await this.connections.getAccessToken(workspaceId);

    const resources =
      await this.atlassianApi.getAccessibleResources(accessToken);

    const resource = resources.find(
      (candidate) => candidate.id === parsed.data.cloudId,
    );

    if (!resource) {
      throw new BadRequestException(
        'Selected Atlassian site is not accessible',
      );
    }

    const connection = await this.connections.selectSite({
      workspaceId,

      cloudId: resource.id,

      siteName: resource.name,

      siteUrl: resource.url,
    });

    return {
      workspaceId: connection.workspaceId,

      state: 'project_selection_required' as const,

      status: connection.status,

      site: {
        cloudId: connection.cloudId,

        name: connection.siteName,

        url: connection.siteUrl,
      },
    };
  }

  @Get('projects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  public async getProjects(
    @CurrentUser()
    principal: AuthPrincipal,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    const connection = await this.connections.requireByWorkspaceId(workspaceId);

    if (!connection.cloudId) {
      throw new BadRequestException('Atlassian site has not been selected');
    }

    const accessToken = await this.connections.getAccessToken(workspaceId);

    return this.atlassianApi.getProjects(accessToken, connection.cloudId);
  }

  @Post('project')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  public async selectProject(
    @CurrentUser()
    principal: AuthPrincipal,

    @Body()
    body: unknown,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

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
  @UseGuards(JwtAuthGuard)
  public async verifyConnection(
    @CurrentUser()
    principal: AuthPrincipal,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

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

  private resolveSetupState(
    cloudId: string | null,
    projectId: string | null,
    projectKey: string | null,
  ): JiraSetupState {
    if (!cloudId) {
      return 'site_selection_required';
    }

    if (!projectId || !projectKey) {
      return 'project_selection_required';
    }

    return 'connected';
  }

  private requireWorkspaceId(principal: AuthPrincipal): string {
    if (!principal.workspaceId) {
      throw new BadRequestException('Workspace membership is required');
    }

    return principal.workspaceId;
  }
}
