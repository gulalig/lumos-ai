import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';

import { AuthRefreshSessionsRepository } from './auth-refresh-sessions.repository.js';
import { AuthRefreshSessionEntity } from './entities/auth-refresh-session.entity.js';
import { RefreshTokenService } from './refresh-token.service.js';

function createFixture() {
  const manager = {
    marker: 'manager',
  } as unknown as EntityManager;

  const dataSource = {
    transaction: vi.fn(
      async (
        callback: (transactionManager: typeof manager) => Promise<unknown>,
      ) => callback(manager),
    ),
  } as unknown as DataSource;

  const sessions = {
    create: vi.fn(),

    findByTokenHashForUpdate: vi.fn(),

    save: vi.fn(async (session: AuthRefreshSessionEntity) => session),

    revokeFamily: vi.fn(),

    revokeAllForUser: vi.fn(),
  } as unknown as AuthRefreshSessionsRepository;

  const config = {
    get: vi.fn((key: keyof Env) => {
      if (key === 'AUTH_REFRESH_TTL_DAYS') {
        return 30;
      }

      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService<Env, true>;

  const service = new RefreshTokenService(dataSource, sessions, config);

  return {
    service,
    sessions,
    manager,
  };
}

describe('RefreshTokenService', () => {
  it('creates a refresh session without storing the raw token', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.sessions.create).mockImplementation(async (input) =>
      Object.assign(new AuthRefreshSessionEntity(), input),
    );

    const result = await fixture.service.create({
      userId: 'user-1',

      workspaceMemberId: null,
    });

    expect(result.refreshToken.length).toBeGreaterThan(40);

    expect(fixture.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',

        workspaceMemberId: null,

        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );

    const createInput = vi.mocked(fixture.sessions.create).mock.calls[0][0];

    expect(createInput.tokenHash).not.toBe(result.refreshToken);
  });

  it('rotates an active refresh token in the same family', async () => {
    const fixture = createFixture();

    const session = Object.assign(new AuthRefreshSessionEntity(), {
      id: 'session-1',

      familyId: 'family-1',

      userId: 'user-1',

      workspaceMemberId: 'member-1',

      expiresAt: new Date(Date.now() + 60_000),

      revokedAt: null,

      revokeReason: null,

      lastUsedAt: null,
    });

    vi.mocked(fixture.sessions.findByTokenHashForUpdate).mockResolvedValue(
      session,
    );

    const result = await fixture.service.rotate('old-refresh-token');

    expect(session.revokedAt).toBeInstanceOf(Date);

    expect(session.revokeReason).toBe('rotated');

    expect(fixture.sessions.save).toHaveBeenCalledWith(
      session,
      fixture.manager,
    );

    expect(fixture.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 'family-1',

        userId: 'user-1',

        workspaceMemberId: 'member-1',

        rotatedFromId: 'session-1',
      }),
      fixture.manager,
    );

    expect(result.userId).toBe('user-1');

    expect(result.workspaceMemberId).toBe('member-1');

    expect(result.refreshToken).not.toBe('old-refresh-token');
  });

  it('revokes the token family when a rotated token is reused', async () => {
    const fixture = createFixture();

    const session = Object.assign(new AuthRefreshSessionEntity(), {
      id: 'session-old',

      familyId: 'family-1',

      userId: 'user-1',

      expiresAt: new Date(Date.now() + 60_000),

      revokedAt: new Date(),

      revokeReason: 'rotated',
    });

    vi.mocked(fixture.sessions.findByTokenHashForUpdate).mockResolvedValue(
      session,
    );

    await expect(
      fixture.service.rotate('reused-refresh-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fixture.sessions.revokeFamily).toHaveBeenCalledWith(
      'family-1',
      expect.any(Date),
      'refresh_token_reuse',
      fixture.manager,
    );
  });

  it('persists expiry revocation before rejecting the token', async () => {
    const fixture = createFixture();

    const session = Object.assign(new AuthRefreshSessionEntity(), {
      id: 'session-expired',

      familyId: 'family-1',

      userId: 'user-1',

      expiresAt: new Date(Date.now() - 60_000),

      revokedAt: null,

      revokeReason: null,

      lastUsedAt: null,
    });

    vi.mocked(fixture.sessions.findByTokenHashForUpdate).mockResolvedValue(
      session,
    );

    await expect(
      fixture.service.rotate('expired-refresh-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(session.revokeReason).toBe('expired');

    expect(session.revokedAt).toBeInstanceOf(Date);

    expect(fixture.sessions.save).toHaveBeenCalledWith(
      session,
      fixture.manager,
    );
  });

  it('transitions a pre-onboarding refresh session into a new family with a workspace membership', async () => {
    const fixture = createFixture();

    const session = Object.assign(new AuthRefreshSessionEntity(), {
      id: 'session-pre-onboarding',

      familyId: 'family-1',

      userId: 'user-1',

      workspaceMemberId: null,

      expiresAt: new Date(Date.now() + 60_000),

      revokedAt: null,

      revokeReason: null,

      lastUsedAt: null,
    });

    vi.mocked(fixture.sessions.findByTokenHashForUpdate).mockResolvedValue(
      session,
    );

    const result = await fixture.service.transitionToWorkspace(
      {
        refreshToken: 'pre-onboarding-refresh-token',

        userId: 'user-1',

        workspaceMemberId: 'member-1',
      },
      fixture.manager,
    );

    expect(session.revokedAt).toBeInstanceOf(Date);

    expect(session.revokeReason).toBe('workspace_onboarding');

    expect(fixture.sessions.save).toHaveBeenCalledWith(
      session,
      fixture.manager,
    );

    expect(fixture.sessions.revokeFamily).toHaveBeenCalledWith(
      'family-1',
      expect.any(Date),
      'workspace_onboarding',
      fixture.manager,
    );

    expect(fixture.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: expect.any(String),

        userId: 'user-1',

        workspaceMemberId: 'member-1',

        rotatedFromId: 'session-pre-onboarding',

        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      fixture.manager,
    );

    const createdInput = vi.mocked(fixture.sessions.create).mock.calls[0][0];

    expect(createdInput.familyId).not.toBe('family-1');

    expect(result.refreshToken).not.toBe('pre-onboarding-refresh-token');

    expect(createdInput.tokenHash).not.toBe(result.refreshToken);
  });

  it('rejects workspace transition when the refresh token belongs to another user', async () => {
    const fixture = createFixture();

    const session = Object.assign(new AuthRefreshSessionEntity(), {
      id: 'session-1',

      familyId: 'family-1',

      userId: 'other-user',

      workspaceMemberId: null,

      expiresAt: new Date(Date.now() + 60_000),

      revokedAt: null,

      revokeReason: null,

      lastUsedAt: null,
    });

    vi.mocked(fixture.sessions.findByTokenHashForUpdate).mockResolvedValue(
      session,
    );

    await expect(
      fixture.service.transitionToWorkspace(
        {
          refreshToken: 'refresh-token',

          userId: 'user-1',

          workspaceMemberId: 'member-1',
        },
        fixture.manager,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fixture.sessions.save).not.toHaveBeenCalled();

    expect(fixture.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects a revoked pre-onboarding refresh token without creating a workspace session', async () => {
    const fixture = createFixture();

    const session = Object.assign(new AuthRefreshSessionEntity(), {
      id: 'session-old',

      familyId: 'family-1',

      userId: 'user-1',

      workspaceMemberId: null,

      expiresAt: new Date(Date.now() + 60_000),

      revokedAt: new Date(),

      revokeReason: 'workspace_onboarding',

      lastUsedAt: new Date(),
    });

    vi.mocked(fixture.sessions.findByTokenHashForUpdate).mockResolvedValue(
      session,
    );

    await expect(
      fixture.service.transitionToWorkspace(
        {
          refreshToken: 'reused-refresh-token',

          userId: 'user-1',

          workspaceMemberId: 'member-1',
        },
        fixture.manager,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fixture.sessions.create).not.toHaveBeenCalled();

    expect(fixture.sessions.save).not.toHaveBeenCalled();
  });

  it('rejects workspace transition when the refresh session is already workspace-bound', async () => {
    const fixture = createFixture();

    const session = Object.assign(new AuthRefreshSessionEntity(), {
      id: 'session-bound',

      familyId: 'family-1',

      userId: 'user-1',

      workspaceMemberId: 'existing-member',

      expiresAt: new Date(Date.now() + 60_000),

      revokedAt: null,

      revokeReason: null,

      lastUsedAt: null,
    });

    vi.mocked(fixture.sessions.findByTokenHashForUpdate).mockResolvedValue(
      session,
    );

    await expect(
      fixture.service.transitionToWorkspace(
        {
          refreshToken: 'workspace-refresh-token',

          userId: 'user-1',

          workspaceMemberId: 'member-2',
        },
        fixture.manager,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fixture.sessions.save).not.toHaveBeenCalled();

    expect(fixture.sessions.create).not.toHaveBeenCalled();
  });
});
