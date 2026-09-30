import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';

import { UserEntity } from '../identity/entities/user.entity.js';
import { WorkspaceMemberEntity } from '../identity/entities/workspace-member.entity.js';
import { UsersRepository } from '../identity/users.repository.js';
import { WorkspaceMembersRepository } from '../identity/workspace-members.repository.js';
import { WorkspaceEntity } from '../identity/entities/workspace.entity.js';

import { JwtStrategy } from './jwt.strategy.js';

function createFixture() {
  const users = {
    findById: vi.fn(),
  } as unknown as UsersRepository;

  const workspaceMembers = {
    findById: vi.fn(),
  } as unknown as WorkspaceMembersRepository;

  const config = {
    get: vi.fn((key: keyof Env) => {
      if (key === 'JWT_ACCESS_SECRET') {
        return 'a'.repeat(48);
      }

      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService<Env, true>;

  const strategy = new JwtStrategy(config, users, workspaceMembers);

  return {
    strategy,
    users,
    workspaceMembers,
  };
}

describe('JwtStrategy', () => {
  it('creates a principal for a verified user before workspace onboarding', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      emailVerifiedAt: new Date(),
    });

    vi.mocked(fixture.users.findById).mockResolvedValue(user);

    const principal = await fixture.strategy.validate({
      sub: 'user-1',

      workspaceMemberId: null,
    });

    expect(principal).toEqual({
      userId: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      workspaceMemberId: null,

      workspaceId: null,

      workspaceName: null,

      role: null,
    });

    expect(fixture.workspaceMembers.findById).not.toHaveBeenCalled();
  });

  it('resolves the current workspace membership from the database', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      emailVerifiedAt: new Date(),
    });

    const workspace = Object.assign(new WorkspaceEntity(), {
      id: 'workspace-1',

      name: 'Test Workspace',

      slug: 'test-workspace',
    });

    const member = Object.assign(new WorkspaceMemberEntity(), {
      id: 'member-1',

      userId: 'user-1',

      workspaceId: 'workspace-1',

      role: 'owner' as const,

      workspace,
    });

    vi.mocked(fixture.users.findById).mockResolvedValue(user);

    vi.mocked(fixture.workspaceMembers.findById).mockResolvedValue(member);

    const principal = await fixture.strategy.validate({
      sub: 'user-1',

      workspaceMemberId: 'member-1',
    });

    expect(principal).toEqual({
      userId: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      workspaceMemberId: 'member-1',

      workspaceName: 'Test Workspace',

      workspaceId: 'workspace-1',

      role: 'owner',
    });
  });

  it('rejects a membership that belongs to another user', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      emailVerifiedAt: new Date(),
    });

    const member = Object.assign(new WorkspaceMemberEntity(), {
      id: 'member-1',

      userId: 'different-user',

      workspaceId: 'workspace-1',

      role: 'owner' as const,
    });

    vi.mocked(fixture.users.findById).mockResolvedValue(user);

    vi.mocked(fixture.workspaceMembers.findById).mockResolvedValue(member);

    await expect(
      fixture.strategy.validate({
        sub: 'user-1',

        workspaceMemberId: 'member-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unverified user even when the JWT is otherwise valid', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      emailVerifiedAt: null,
    });

    vi.mocked(fixture.users.findById).mockResolvedValue(user);

    await expect(
      fixture.strategy.validate({
        sub: 'user-1',

        workspaceMemberId: null,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
