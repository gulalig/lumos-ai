import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuthPrincipal } from '../../auth/auth-principal.js';

import { JiraOAuthController } from './jira-oauth.controller.js';

function createPrincipal(
  role: 'owner' | 'admin' | 'member' = 'owner',
): AuthPrincipal {
  return {
    userId: 'user-1',

    email: 'user@example.com',

    displayName: 'User',

    workspaceMemberId: 'member-1',

    workspaceId: 'workspace-1',

    role,
  };
}

function createFixture() {
  const oauth = {
    createAuthorizationUrl: vi.fn(
      (state: string) => `https://auth.example.com?state=${state}`,
    ),

    refreshAccessToken: vi.fn(),

    exchangeCode: vi.fn(),
  };

  const oauthState = {
    create: vi.fn(async () => 'state-1'),

    consume: vi.fn(),
  };

  const connections = {
    getByWorkspaceId: vi.fn(),

    getRefreshToken: vi.fn(),

    replaceTokens: vi.fn(),

    saveTokens: vi.fn(),

    selectSite: vi.fn(),

    requireByWorkspaceId: vi.fn(),

    getAccessToken: vi.fn(),

    selectProject: vi.fn(),
  };

  const atlassianApi = {
    getAccessibleResources: vi.fn(),

    getProjects: vi.fn(),

    getProject: vi.fn(),
  };

  const controller = new JiraOAuthController(
    oauth as any,
    oauthState as any,
    connections as any,
    atlassianApi as any,
  );

  return {
    controller,
    oauth,
    oauthState,
    connections,
    atlassianApi,
  };
}

describe('JiraOAuthController workspace scoping', () => {
  it('uses the authenticated principal workspace for OAuth authorize', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.authorize(createPrincipal('owner'));

    expect(fixture.oauthState.create).toHaveBeenCalledWith('workspace-1');

    expect(result).toEqual({
      url: 'https://auth.example.com?state=state-1',
    });
  });

  it('returns authorization_required when no Jira connection exists', async () => {
    const fixture = createFixture();

    fixture.connections.getByWorkspaceId.mockResolvedValue(null);

    const result = await fixture.controller.getSetupState(
      createPrincipal('member'),
    );

    expect(fixture.connections.getByWorkspaceId).toHaveBeenCalledWith(
      'workspace-1',
    );

    expect(result).toEqual({
      workspaceId: 'workspace-1',

      state: 'authorization_required',

      status: 'not_configured',

      site: null,

      project: null,

      lastError: null,
    });
  });

  it('returns site_selection_required when OAuth tokens exist but no site is selected', async () => {
    const fixture = createFixture();

    fixture.connections.getByWorkspaceId.mockResolvedValue({
      workspaceId: 'workspace-1',

      cloudId: null,

      siteName: null,

      siteUrl: null,

      projectId: null,

      projectKey: null,

      projectName: null,

      status: 'pending',

      lastError: null,
    });

    const result = await fixture.controller.getSetupState(
      createPrincipal('member'),
    );

    expect(result.state).toBe('site_selection_required');

    expect(result.site).toBeNull();

    expect(result.project).toBeNull();
  });

  it('returns project_selection_required when a site is selected but no project is selected', async () => {
    const fixture = createFixture();

    fixture.connections.getByWorkspaceId.mockResolvedValue({
      workspaceId: 'workspace-1',

      cloudId: 'cloud-1',

      siteName: 'Example Site',

      siteUrl: 'https://example.atlassian.net',

      projectId: null,

      projectKey: null,

      projectName: null,

      status: 'pending',

      lastError: null,
    });

    const result = await fixture.controller.getSetupState(
      createPrincipal('member'),
    );

    expect(result.state).toBe('project_selection_required');

    expect(result.site).toEqual({
      cloudId: 'cloud-1',

      name: 'Example Site',

      url: 'https://example.atlassian.net',
    });

    expect(result.project).toBeNull();
  });

  it('returns connected setup state when site and project are configured', async () => {
    const fixture = createFixture();

    fixture.connections.getByWorkspaceId.mockResolvedValue({
      workspaceId: 'workspace-1',

      cloudId: 'cloud-1',

      siteName: 'Example Site',

      siteUrl: 'https://example.atlassian.net',

      projectId: 'project-1',

      projectKey: 'LUM',

      projectName: 'Lumos',

      status: 'connected',

      lastError: null,
    });

    const result = await fixture.controller.getSetupState(
      createPrincipal('member'),
    );

    expect(result).toEqual({
      workspaceId: 'workspace-1',

      state: 'connected',

      status: 'connected',

      site: {
        cloudId: 'cloud-1',

        name: 'Example Site',

        url: 'https://example.atlassian.net',
      },

      project: {
        id: 'project-1',

        key: 'LUM',

        name: 'Lumos',
      },

      lastError: null,
    });
  });

  it('returns site_selection_required from OAuth callback when multiple Atlassian sites are accessible', async () => {
    const fixture = createFixture();

    fixture.oauthState.consume.mockResolvedValue('workspace-from-state');

    fixture.oauth.exchangeCode.mockResolvedValue({
      accessToken: 'access-token',

      refreshToken: 'refresh-token',

      expiresIn: 3600,

      scopes: ['read:jira-work'],
    });

    fixture.atlassianApi.getAccessibleResources.mockResolvedValue([
      {
        id: 'cloud-1',

        name: 'Site One',

        url: 'https://one.atlassian.net',

        scopes: [],
      },
      {
        id: 'cloud-2',

        name: 'Site Two',

        url: 'https://two.atlassian.net',

        scopes: [],
      },
    ]);

    const result = await fixture.controller.callback('oauth-code', 'state-1');

    expect(fixture.connections.saveTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-from-state',

        accessToken: 'access-token',
      }),
    );

    expect(fixture.connections.selectSite).not.toHaveBeenCalled();

    expect(result).toEqual({
      workspaceId: 'workspace-from-state',

      status: 'site_selection_required',

      siteCount: 2,
    });
  });

  it('returns accessible Atlassian sites for the authenticated workspace', async () => {
    const fixture = createFixture();

    fixture.connections.requireByWorkspaceId.mockResolvedValue({
      workspaceId: 'workspace-1',
    });

    fixture.connections.getAccessToken.mockResolvedValue('access-token');

    fixture.atlassianApi.getAccessibleResources.mockResolvedValue([
      {
        id: 'cloud-1',

        name: 'Example Site',

        url: 'https://example.atlassian.net',

        scopes: ['read:jira-work'],
      },
    ]);

    const result = await fixture.controller.getSites(createPrincipal('owner'));

    expect(fixture.connections.requireByWorkspaceId).toHaveBeenCalledWith(
      'workspace-1',
    );

    expect(fixture.connections.getAccessToken).toHaveBeenCalledWith(
      'workspace-1',
    );

    expect(fixture.atlassianApi.getAccessibleResources).toHaveBeenCalledWith(
      'access-token',
    );

    expect(result).toHaveLength(1);
  });

  it('selects only an Atlassian site accessible to the authenticated workspace', async () => {
    const fixture = createFixture();

    fixture.connections.requireByWorkspaceId.mockResolvedValue({
      workspaceId: 'workspace-1',
    });

    fixture.connections.getAccessToken.mockResolvedValue('access-token');

    fixture.atlassianApi.getAccessibleResources.mockResolvedValue([
      {
        id: 'cloud-1',

        name: 'Example Site',

        url: 'https://example.atlassian.net',

        scopes: ['read:jira-work'],
      },
    ]);

    fixture.connections.selectSite.mockResolvedValue({
      workspaceId: 'workspace-1',

      cloudId: 'cloud-1',

      siteName: 'Example Site',

      siteUrl: 'https://example.atlassian.net',

      status: 'pending',
    });

    const result = await fixture.controller.selectSite(
      createPrincipal('owner'),
      {
        cloudId: 'cloud-1',
      },
    );

    expect(fixture.connections.selectSite).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',

      cloudId: 'cloud-1',

      siteName: 'Example Site',

      siteUrl: 'https://example.atlassian.net',
    });

    expect(result.state).toBe('project_selection_required');
  });

  it('rejects selection of an inaccessible Atlassian site', async () => {
    const fixture = createFixture();

    fixture.connections.requireByWorkspaceId.mockResolvedValue({
      workspaceId: 'workspace-1',
    });

    fixture.connections.getAccessToken.mockResolvedValue('access-token');

    fixture.atlassianApi.getAccessibleResources.mockResolvedValue([
      {
        id: 'cloud-1',

        name: 'Example Site',

        url: 'https://example.atlassian.net',

        scopes: [],
      },
    ]);

    await expect(
      fixture.controller.selectSite(createPrincipal('owner'), {
        cloudId: 'cloud-not-accessible',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.connections.selectSite).not.toHaveBeenCalled();
  });

  it('uses the authenticated principal workspace for Jira connection lookup', async () => {
    const fixture = createFixture();

    fixture.connections.requireByWorkspaceId.mockResolvedValue({
      workspaceId: 'workspace-1',

      cloudId: 'cloud-1',

      projectId: 'project-1',

      projectKey: 'LUM',

      projectName: 'Lumos',

      siteName: 'Example Site',

      siteUrl: 'https://example.atlassian.net',

      status: 'connected',
    });

    fixture.connections.getAccessToken.mockResolvedValue('access-token');

    fixture.atlassianApi.getProject.mockResolvedValue({
      id: 'project-1',

      key: 'LUM',

      name: 'Lumos',
    });

    const result = await fixture.controller.verifyConnection(
      createPrincipal('member'),
    );

    expect(fixture.connections.requireByWorkspaceId).toHaveBeenCalledWith(
      'workspace-1',
    );

    expect(fixture.connections.getAccessToken).toHaveBeenCalledWith(
      'workspace-1',
    );

    expect(result.workspaceId).toBe('workspace-1');
  });

  it('rejects a principal without a workspace', async () => {
    const fixture = createFixture();

    const principal: AuthPrincipal = {
      userId: 'user-1',

      email: 'user@example.com',

      displayName: 'User',

      workspaceMemberId: null,

      workspaceId: null,

      role: null,
    };

    await expect(
      fixture.controller.authorize(principal),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.oauthState.create).not.toHaveBeenCalled();
  });

  it('keeps OAuth callback workspace resolution bound to state for a single accessible site', async () => {
    const fixture = createFixture();

    fixture.oauthState.consume.mockResolvedValue('workspace-from-state');

    fixture.oauth.exchangeCode.mockResolvedValue({
      accessToken: 'access-token',

      refreshToken: 'refresh-token',

      expiresIn: 3600,

      scopes: ['read:jira-work'],
    });

    fixture.atlassianApi.getAccessibleResources.mockResolvedValue([
      {
        id: 'cloud-1',

        name: 'Example Site',

        url: 'https://example.atlassian.net',

        scopes: ['read:jira-work'],
      },
    ]);

    fixture.connections.saveTokens.mockResolvedValue(undefined);

    fixture.connections.selectSite.mockResolvedValue(undefined);

    const result = await fixture.controller.callback('oauth-code', 'state-1');

    expect(fixture.oauthState.consume).toHaveBeenCalledWith('state-1');

    expect(fixture.connections.saveTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-from-state',
      }),
    );

    expect(fixture.connections.selectSite).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-from-state',
      }),
    );

    expect(result.workspaceId).toBe('workspace-from-state');

    expect(result.status).toBe('authorized');
  });
});
