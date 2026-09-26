import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthPrincipal } from '../auth/auth-principal.js';
import type { RefreshCookieService } from '../auth/refresh-cookie.service.js';

import { OnboardingController } from './onboarding.controller.js';
import type { OnboardingService } from './onboarding.service.js';

function createPrincipal(workspaceId: string | null = null): AuthPrincipal {
  return {
    userId: 'user-1',

    email: 'user@example.com',

    displayName: 'User',

    workspaceMemberId: workspaceId ? 'member-1' : null,

    workspaceId,

    role: workspaceId ? 'owner' : null,
  };
}

function createFixture() {
  const onboarding = {
    createWorkspace: vi.fn(),
  } as unknown as OnboardingService;

  const refreshCookies = {
    read: vi.fn(),

    set: vi.fn(),
  } as unknown as RefreshCookieService;

  const controller = new OnboardingController(onboarding, refreshCookies);

  const request = {} as FastifyRequest;

  const reply = {} as FastifyReply;

  return {
    controller,
    onboarding,
    refreshCookies,
    request,
    reply,
  };
}

describe('OnboardingController', () => {
  it('creates a workspace for a pre-onboarding authenticated user and replaces the refresh cookie', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.refreshCookies.read).mockReturnValue('old-refresh-token');

    vi.mocked(fixture.onboarding.createWorkspace).mockResolvedValue({
      accessToken: 'new-access-token',

      tokenType: 'Bearer',

      expiresInSeconds: 900,

      refreshToken: 'new-refresh-token',

      refreshTokenExpiresAt: new Date(),

      workspace: {
        id: 'workspace-1',

        name: 'Lumos Team',

        slug: 'lumos-team-12345678',

        workspaceMemberId: 'member-1',

        role: 'owner',
      },
    });

    const result = await fixture.controller.createWorkspace(
      createPrincipal(),
      {
        name: 'Lumos Team',
      },
      fixture.request,
      fixture.reply,
    );

    expect(fixture.onboarding.createWorkspace).toHaveBeenCalledWith({
      userId: 'user-1',

      refreshToken: 'old-refresh-token',

      workspaceName: 'Lumos Team',
    });

    expect(fixture.refreshCookies.set).toHaveBeenCalledWith(
      fixture.reply,
      'new-refresh-token',
    );

    expect(result).toEqual({
      accessToken: 'new-access-token',

      tokenType: 'Bearer',

      expiresInSeconds: 900,

      workspace: {
        id: 'workspace-1',

        name: 'Lumos Team',

        slug: 'lumos-team-12345678',

        workspaceMemberId: 'member-1',

        role: 'owner',
      },
    });
  });

  it('rejects onboarding when the principal already belongs to a workspace', async () => {
    const fixture = createFixture();

    await expect(
      fixture.controller.createWorkspace(
        createPrincipal('workspace-1'),
        {
          name: 'Another Workspace',
        },
        fixture.request,
        fixture.reply,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.onboarding.createWorkspace).not.toHaveBeenCalled();
  });

  it('rejects onboarding without a refresh cookie', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.refreshCookies.read).mockReturnValue(null);

    await expect(
      fixture.controller.createWorkspace(
        createPrincipal(),
        {
          name: 'Lumos Team',
        },
        fixture.request,
        fixture.reply,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.onboarding.createWorkspace).not.toHaveBeenCalled();
  });
});
