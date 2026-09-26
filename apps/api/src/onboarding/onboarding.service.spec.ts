import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AccessTokenService } from '../auth/access-token.service.js';
import type { RefreshTokenService } from '../auth/refresh-token.service.js';
import type { UsersRepository } from '../identity/users.repository.js';
import type { WorkspaceMembersRepository } from '../identity/workspace-members.repository.js';
import type { WorkspacesRepository } from '../identity/workspaces.repository.js';

import { OnboardingService } from './onboarding.service.js';

function createFixture() {
  const manager = {};

  const dataSource = {
    transaction: vi.fn(
      async (callback: (manager: unknown) => Promise<unknown>) =>
        callback(manager),
    ),
  };

  const users = {
    findByIdForUpdate: vi.fn(),
  } as unknown as UsersRepository;

  const workspaces = {
    create: vi.fn(),
  } as unknown as WorkspacesRepository;

  const workspaceMembers = {
    findFirstByUserId: vi.fn(),

    create: vi.fn(),
  } as unknown as WorkspaceMembersRepository;

  const accessTokens = {
    create: vi.fn(),
  } as unknown as AccessTokenService;

  const refreshTokens = {
    transitionToWorkspace: vi.fn(),
  } as unknown as RefreshTokenService;

  const service = new OnboardingService(
    dataSource as never,
    users,
    workspaces,
    workspaceMembers,
    accessTokens,
    refreshTokens,
  );

  return {
    service,
    dataSource,
    manager,
    users,
    workspaces,
    workspaceMembers,
    accessTokens,
    refreshTokens,
  };
}

describe('OnboardingService', () => {
  it('creates a workspace owner membership and transitions authentication into the workspace', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.users.findByIdForUpdate).mockResolvedValue({
      id: 'user-1',

      emailVerifiedAt: new Date(),
    } as never);

    vi.mocked(fixture.workspaceMembers.findFirstByUserId).mockResolvedValue(
      null,
    );

    vi.mocked(fixture.workspaces.create).mockImplementation(
      async (input) =>
        ({
          ...input,

          createdAt: new Date(),

          updatedAt: new Date(),
        }) as never,
    );

    vi.mocked(fixture.workspaceMembers.create).mockImplementation(
      async (input) =>
        ({
          ...input,

          createdAt: new Date(),

          updatedAt: new Date(),
        }) as never,
    );

    vi.mocked(fixture.refreshTokens.transitionToWorkspace).mockResolvedValue({
      refreshToken: 'new-refresh-token',

      expiresAt: new Date('2026-10-26T00:00:00.000Z'),
    });

    vi.mocked(fixture.accessTokens.create).mockResolvedValue({
      accessToken: 'new-access-token',

      expiresInSeconds: 900,
    });

    const result = await fixture.service.createWorkspace({
      userId: 'user-1',

      refreshToken: 'old-refresh-token',

      workspaceName: 'Lumos Team',
    });

    expect(fixture.users.findByIdForUpdate).toHaveBeenCalledWith(
      'user-1',
      fixture.manager,
    );

    expect(fixture.workspaceMembers.findFirstByUserId).toHaveBeenCalledWith(
      'user-1',
      fixture.manager,
    );

    expect(fixture.workspaces.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lumos Team',
      }),
      fixture.manager,
    );

    expect(fixture.workspaceMembers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',

        role: 'owner',
      }),
      fixture.manager,
    );

    const membership = vi.mocked(fixture.workspaceMembers.create).mock
      .results[0];

    expect(fixture.refreshTokens.transitionToWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: 'old-refresh-token',

        userId: 'user-1',

        workspaceMemberId: expect.any(String),
      }),
      fixture.manager,
    );

    expect(fixture.accessTokens.create).toHaveBeenCalledWith({
      userId: 'user-1',

      workspaceMemberId: expect.any(String),
    });

    expect(result.accessToken).toBe('new-access-token');

    expect(result.workspace.name).toBe('Lumos Team');

    expect(result.workspace.role).toBe('owner');

    expect(membership).toBeDefined();
  });

  it('rejects a second workspace onboarding for a user that already has membership', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.users.findByIdForUpdate).mockResolvedValue({
      id: 'user-1',

      emailVerifiedAt: new Date(),
    } as never);

    vi.mocked(fixture.workspaceMembers.findFirstByUserId).mockResolvedValue({
      id: 'member-existing',
    } as never);

    await expect(
      fixture.service.createWorkspace({
        userId: 'user-1',

        refreshToken: 'refresh-token',

        workspaceName: 'Another Workspace',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fixture.workspaces.create).not.toHaveBeenCalled();

    expect(fixture.refreshTokens.transitionToWorkspace).not.toHaveBeenCalled();
  });

  it('rejects an empty workspace name', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.createWorkspace({
        userId: 'user-1',

        refreshToken: 'refresh-token',

        workspaceName: '   ',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fixture.dataSource.transaction).not.toHaveBeenCalled();
  });
});
