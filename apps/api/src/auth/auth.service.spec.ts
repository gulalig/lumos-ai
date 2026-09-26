import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { UserEntity } from '../identity/entities/user.entity.js';
import { WorkspaceMemberEntity } from '../identity/entities/workspace-member.entity.js';
import { UsersRepository } from '../identity/users.repository.js';
import { WorkspaceMembersRepository } from '../identity/workspace-members.repository.js';

import { AccessTokenService } from './access-token.service.js';
import { AuthEmailService } from './auth-email.service.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

function createFixture() {
  const manager = {
    marker: 'transaction-manager',
  };

  type TestManager = typeof manager;

  const dataSource = {
    transaction: vi.fn(
      async (callback: (transactionManager: TestManager) => Promise<unknown>) =>
        callback(manager),
    ),
  } as unknown as DataSource;

  const users = {
    findByEmail: vi.fn(),

    create: vi.fn(),

    markEmailVerified: vi.fn(),

    updatePasswordHash: vi.fn(),
  } as unknown as UsersRepository;

  const workspaceMembers = {
    findFirstByUserId: vi.fn(),
  } as unknown as WorkspaceMembersRepository;

  const passwords = {
    hash: vi.fn(async () => '$argon2id$test-hash'),

    verify: vi.fn(),
  } as unknown as PasswordService;

  const accessTokens = {
    create: vi.fn(async () => ({
      accessToken: 'signed-access-token',

      expiresInSeconds: 900,
    })),
  } as unknown as AccessTokenService;

  const refreshTokens = {
    create: vi.fn(async () => ({
      refreshToken: 'raw-refresh-token',

      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })),

    rotate: vi.fn(),

    revoke: vi.fn(),

    revokeAllForUser: vi.fn(),
  } as unknown as RefreshTokenService;

  const email = {
    sendVerificationCode: vi.fn(),

    sendPasswordResetCode: vi.fn(),
  } as unknown as AuthEmailService;

  const otp = {
    createChallenge: vi.fn(async () => ({
      challengeId: 'challenge-1',

      code: '123456',

      expiresAt: new Date(Date.now() + 10 * 60_000),
    })),

    verifyCode: vi.fn(),
  } as unknown as OtpService;

  const service = new AuthService(
    dataSource,
    users,
    workspaceMembers,
    passwords,
    accessTokens,
    refreshTokens,
    email,
    otp,
  );

  return {
    service,
    dataSource,
    users,
    workspaceMembers,
    passwords,
    accessTokens,
    refreshTokens,
    otp,
    email,
    manager,
  };
}

describe('AuthService signup', () => {
  it('creates the user and verification OTP in the same transaction', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(null);

    vi.mocked(fixture.users.create).mockImplementation(async (input) =>
      Object.assign(new UserEntity(), {
        ...input,
        emailVerifiedAt: null,
      }),
    );

    const result = await fixture.service.signup({
      email: ' Test@Example.com ',

      displayName: ' Gulali ',

      password: 'very-secure-password',
    });

    expect(fixture.passwords.hash).toHaveBeenCalledWith('very-secure-password');

    expect(fixture.users.findByEmail).toHaveBeenCalledWith(
      'test@example.com',
      fixture.manager,
    );

    expect(fixture.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',

        displayName: 'Gulali',

        passwordHash: '$argon2id$test-hash',
      }),
      fixture.manager,
    );

    expect(fixture.otp.createChallenge).toHaveBeenCalledWith(
      {
        userId: expect.any(String),

        email: 'test@example.com',

        purpose: 'verify_email',
      },
      fixture.manager,
    );

    expect(fixture.email.sendVerificationCode).toHaveBeenCalledWith({
      email: 'test@example.com',

      displayName: 'Gulali',

      code: '123456',

      expiresAt: expect.any(Date),
    });

    expect(result.email).toBe('test@example.com');

    expect(result.challengeId).toBe('challenge-1');

    expect(result.verificationRequired).toBe(true);

    expect(result).not.toHaveProperty('code');

    expect(result).not.toHaveProperty('otp');
  });

  it('rejects an existing normalized email without creating a user', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(
      Object.assign(new UserEntity(), {
        id: 'existing-user',

        email: 'test@example.com',
      }),
    );

    await expect(
      fixture.service.signup({
        email: ' TEST@example.com ',

        displayName: 'Test User',

        password: 'very-secure-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fixture.users.create).not.toHaveBeenCalled();

    expect(fixture.otp.createChallenge).not.toHaveBeenCalled();

    expect(fixture.email.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than ten characters before opening a transaction', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.signup({
        email: 'test@example.com',

        displayName: 'Test User',

        password: 'short',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fixture.dataSource.transaction).not.toHaveBeenCalled();

    expect(fixture.passwords.hash).not.toHaveBeenCalled();

    expect(fixture.email.sendVerificationCode).not.toHaveBeenCalled();
  });
});

describe('AuthService login', () => {
  it('logs in a verified user without a workspace', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      passwordHash: '$argon2id$stored-hash',

      emailVerifiedAt: new Date(),
    });

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(user);

    vi.mocked(fixture.passwords.verify).mockResolvedValue(true);

    vi.mocked(fixture.workspaceMembers.findFirstByUserId).mockResolvedValue(
      null,
    );

    const result = await fixture.service.login({
      email: ' TEST@example.com ',

      password: 'correct-password',
    });

    expect(fixture.passwords.verify).toHaveBeenCalledWith(
      '$argon2id$stored-hash',
      'correct-password',
    );

    expect(fixture.accessTokens.create).toHaveBeenCalledWith({
      userId: 'user-1',

      workspaceMemberId: null,
    });

    expect(fixture.refreshTokens.create).toHaveBeenCalledWith({
      userId: 'user-1',

      workspaceMemberId: null,
    });

    expect(result.accessToken).toBe('signed-access-token');

    expect(result.tokenType).toBe('Bearer');

    expect(result.expiresInSeconds).toBe(900);

    expect(result.refreshToken).toBe('raw-refresh-token');

    expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);

    expect(result.workspace).toBeNull();
  });

  it('includes the active workspace membership in the access token', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      passwordHash: '$argon2id$stored-hash',

      emailVerifiedAt: new Date(),
    });

    const membership = Object.assign(new WorkspaceMemberEntity(), {
      id: 'member-1',

      userId: 'user-1',

      workspaceId: 'workspace-1',

      role: 'owner' as const,

      createdAt: new Date(),
    });

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(user);

    vi.mocked(fixture.passwords.verify).mockResolvedValue(true);

    vi.mocked(fixture.workspaceMembers.findFirstByUserId).mockResolvedValue(
      membership,
    );

    const result = await fixture.service.login({
      email: 'test@example.com',

      password: 'correct-password',
    });

    expect(fixture.accessTokens.create).toHaveBeenCalledWith({
      userId: 'user-1',

      workspaceMemberId: 'member-1',
    });

    expect(fixture.refreshTokens.create).toHaveBeenCalledWith({
      userId: 'user-1',

      workspaceMemberId: 'member-1',
    });

    expect(result.workspace).toEqual({
      workspaceMemberId: 'member-1',

      workspaceId: 'workspace-1',

      role: 'owner',
    });
  });

  it('rejects an incorrect password', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      passwordHash: '$argon2id$stored-hash',

      emailVerifiedAt: new Date(),
    });

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(user);

    vi.mocked(fixture.passwords.verify).mockResolvedValue(false);

    await expect(
      fixture.service.login({
        email: 'test@example.com',

        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fixture.accessTokens.create).not.toHaveBeenCalled();

    expect(fixture.refreshTokens.create).not.toHaveBeenCalled();
  });

  it('rejects an unverified account', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      passwordHash: '$argon2id$stored-hash',

      emailVerifiedAt: null,
    });

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(user);

    vi.mocked(fixture.passwords.verify).mockResolvedValue(true);

    await expect(
      fixture.service.login({
        email: 'test@example.com',

        password: 'correct-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fixture.accessTokens.create).not.toHaveBeenCalled();

    expect(fixture.refreshTokens.create).not.toHaveBeenCalled();
  });
});

describe('AuthService logout', () => {
  it('revokes the current refresh token', async () => {
    const fixture = createFixture();

    const result = await fixture.service.logout('raw-refresh-token');

    expect(fixture.refreshTokens.revoke).toHaveBeenCalledWith(
      'raw-refresh-token',
    );

    expect(result).toEqual({
      loggedOut: true,
    });
  });

  it('remains idempotent when no refresh token is present', async () => {
    const fixture = createFixture();

    const result = await fixture.service.logout('');

    expect(fixture.refreshTokens.revoke).toHaveBeenCalledWith('');

    expect(result).toEqual({
      loggedOut: true,
    });
  });
});

describe('AuthService forgot password', () => {
  it('creates and sends a reset OTP for an existing user', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      passwordHash: '$argon2id$stored-hash',

      emailVerifiedAt: new Date(),
    });

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(user);

    const result = await fixture.service.forgotPassword({
      email: ' TEST@example.com ',
    });

    expect(fixture.otp.createChallenge).toHaveBeenCalledWith({
      userId: 'user-1',

      email: 'test@example.com',

      purpose: 'reset_password',
    });

    expect(fixture.email.sendPasswordResetCode).toHaveBeenCalledWith({
      email: 'test@example.com',

      displayName: 'Test User',

      code: '123456',

      expiresAt: expect.any(Date),
    });

    expect(result).toEqual({
      sent: true,
    });
  });

  it('returns the same response for an unknown email', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(null);

    const result = await fixture.service.forgotPassword({
      email: 'missing@example.com',
    });

    expect(result).toEqual({
      sent: true,
    });

    expect(fixture.otp.createChallenge).not.toHaveBeenCalled();

    expect(fixture.email.sendPasswordResetCode).not.toHaveBeenCalled();
  });
});

describe('AuthService reset password', () => {
  it('verifies the OTP, updates the password, and revokes all refresh sessions', async () => {
    const fixture = createFixture();

    const user = Object.assign(new UserEntity(), {
      id: 'user-1',

      email: 'test@example.com',

      displayName: 'Test User',

      passwordHash: '$argon2id$old-hash',

      emailVerifiedAt: new Date(),
    });

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(user);

    vi.mocked(fixture.passwords.hash).mockResolvedValue('$argon2id$new-hash');

    const result = await fixture.service.resetPassword({
      email: ' TEST@example.com ',

      code: '123456',

      newPassword: 'new-secure-password',
    });

    expect(fixture.passwords.hash).toHaveBeenCalledWith('new-secure-password');

    expect(fixture.otp.verifyCode).toHaveBeenCalledWith(
      {
        email: 'test@example.com',

        purpose: 'reset_password',

        code: '123456',
      },
      fixture.manager,
    );

    expect(fixture.users.updatePasswordHash).toHaveBeenCalledWith(
      user,
      '$argon2id$new-hash',
      fixture.manager,
    );

    expect(fixture.refreshTokens.revokeAllForUser).toHaveBeenCalledWith(
      'user-1',
      'password_reset',
      fixture.manager,
    );

    expect(result).toEqual({
      passwordReset: true,
    });
  });

  it('rejects an invalid reset code format before opening a transaction', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.resetPassword({
        email: 'test@example.com',

        code: '12',

        newPassword: 'new-secure-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.dataSource.transaction).not.toHaveBeenCalled();

    expect(fixture.passwords.hash).not.toHaveBeenCalled();
  });

  it('rejects a short new password before opening a transaction', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.resetPassword({
        email: 'test@example.com',

        code: '123456',

        newPassword: 'short',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.dataSource.transaction).not.toHaveBeenCalled();

    expect(fixture.passwords.hash).not.toHaveBeenCalled();
  });

  it('rejects an unknown user without updating a password', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.users.findByEmail).mockResolvedValue(null);

    await expect(
      fixture.service.resetPassword({
        email: 'missing@example.com',

        code: '123456',

        newPassword: 'new-secure-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.users.updatePasswordHash).not.toHaveBeenCalled();

    expect(fixture.refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });
});
