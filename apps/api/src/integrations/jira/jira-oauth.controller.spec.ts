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

  it('keeps OAuth callback workspace resolution bound to state', async () => {
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
  });
});
