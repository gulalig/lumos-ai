import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { UsersRepository } from '../identity/users.repository.js';
import { WorkspaceMembersRepository } from '../identity/workspace-members.repository.js';

import { AuthEmailService } from './auth-email.service.js';
import { OtpService } from './otp.service.js';
import { PasswordService } from './password.service.js';
import { AccessTokenService } from './access-token.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

export interface SignupInput {
  email: string;
  displayName: string;
  password: string;
}

export interface SignupResult {
  userId: string;
  email: string;
  verificationRequired: true;
  challengeId: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  public constructor(
    private readonly dataSource: DataSource,

    private readonly users: UsersRepository,

    private readonly workspaceMembers: WorkspaceMembersRepository,

    private readonly passwords: PasswordService,

    private readonly accessTokens: AccessTokenService,

    private readonly refreshTokens: RefreshTokenService,

    private readonly email: AuthEmailService,

    private readonly otp: OtpService,
  ) {}

  public async login(input: { email: string; password: string }): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    expiresInSeconds: number;
    user: {
      id: string;
      email: string;
      displayName: string;
    };
    workspace: {
      workspaceMemberId: string;
      workspaceId: string;
      role: 'owner' | 'admin' | 'member';
    } | null;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
  }> {
    const email = input.email.trim().toLowerCase();

    const user = await this.users.findByEmail(email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await this.passwords.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email verification is required');
    }

    const membership = await this.workspaceMembers.findFirstByUserId(user.id);

    const token = await this.accessTokens.create({
      userId: user.id,

      workspaceMemberId: membership?.id ?? null,
    });

    const refresh = await this.refreshTokens.create({
      userId: user.id,

      workspaceMemberId: membership?.id ?? null,
    });

    return {
      accessToken: token.accessToken,

      tokenType: 'Bearer',

      expiresInSeconds: token.expiresInSeconds,

      user: {
        id: user.id,

        email: user.email,

        displayName: user.displayName,
      },

      workspace: membership
        ? {
            workspaceMemberId: membership.id,

            workspaceId: membership.workspaceId,

            role: membership.role,
          }
        : null,
      refreshToken: refresh.refreshToken,

      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  public async signup(input: SignupInput): Promise<SignupResult> {
    const email = input.email.trim().toLowerCase();

    const displayName = input.displayName.trim();

    if (!email) {
      throw new ConflictException('Email is required');
    }

    if (!displayName) {
      throw new ConflictException('Display name is required');
    }

    if (input.password.length < 10) {
      throw new ConflictException('Password must be at least 10 characters');
    }

    const passwordHash = await this.passwords.hash(input.password);

    const created = await this.dataSource.transaction(async (manager) => {
      const existing = await this.users.findByEmail(email, manager);

      if (existing) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      const user = await this.users.create(
        {
          id: randomUUID(),

          email,

          displayName,

          passwordHash,
        },
        manager,
      );

      const otp = await this.otp.createChallenge(
        {
          userId: user.id,

          email: user.email,

          purpose: 'verify_email',
        },
        manager,
      );

      return {
        userId: user.id,

        email: user.email,

        otp,
      };
    });

    await this.email.sendVerificationCode({
      email: created.email,

      displayName,

      code: created.otp.code,

      expiresAt: created.otp.expiresAt,
    });

    return {
      userId: created.userId,

      email: created.email,

      verificationRequired: true,

      challengeId: created.otp.challengeId,

      expiresAt: created.otp.expiresAt,
    };
  }

  public async verifyEmail(input: { email: string; code: string }): Promise<{
    verified: true;
  }> {
    const email = input.email.trim().toLowerCase();

    if (!/^\d{6}$/.test(input.code)) {
      throw new BadRequestException(
        'Verification code must contain exactly 6 digits',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const user = await this.users.findByEmail(email, manager);

      if (!user) {
        throw new BadRequestException(
          'Verification code is invalid or expired',
        );
      }

      if (user.emailVerifiedAt) {
        return;
      }

      await this.otp.verifyCode(
        {
          email,

          purpose: 'verify_email',

          code: input.code,
        },
        manager,
      );

      await this.users.markEmailVerified(user, new Date(), manager);
    });

    return {
      verified: true,
    };
  }

  public async resendEmailVerification(input: { email: string }): Promise<{
    sent: true;
    expiresAt: Date | null;
  }> {
    const email = input.email.trim().toLowerCase();

    const user = await this.users.findByEmail(email);

    if (!user || user.emailVerifiedAt) {
      return {
        sent: true,
        expiresAt: null,
      };
    }

    const otp = await this.otp.createChallenge({
      userId: user.id,

      email: user.email,

      purpose: 'verify_email',
    });

    await this.email.sendVerificationCode({
      email: user.email,

      displayName: user.displayName,

      code: otp.code,

      expiresAt: otp.expiresAt,
    });

    return {
      sent: true,

      expiresAt: otp.expiresAt,
    };
  }

  public async refresh(refreshToken: string): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    expiresInSeconds: number;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
  }> {
    const rotated = await this.refreshTokens.rotate(refreshToken);

    const access = await this.accessTokens.create({
      userId: rotated.userId,

      workspaceMemberId: rotated.workspaceMemberId,
    });

    return {
      accessToken: access.accessToken,

      tokenType: 'Bearer',

      expiresInSeconds: access.expiresInSeconds,

      refreshToken: rotated.refreshToken,

      refreshTokenExpiresAt: rotated.expiresAt,
    };
  }

  public async logout(refreshToken: string): Promise<{
    loggedOut: true;
  }> {
    await this.refreshTokens.revoke(refreshToken);

    return {
      loggedOut: true,
    };
  }

  public async forgotPassword(input: { email: string }): Promise<{
    sent: true;
  }> {
    const email = input.email.trim().toLowerCase();

    const user = await this.users.findByEmail(email);

    if (!user) {
      return {
        sent: true,
      };
    }

    const otp = await this.otp.createChallenge({
      userId: user.id,

      email: user.email,

      purpose: 'reset_password',
    });

    await this.email.sendPasswordResetCode({
      email: user.email,

      displayName: user.displayName,

      code: otp.code,

      expiresAt: otp.expiresAt,
    });

    return {
      sent: true,
    };
  }

  public async resetPassword(input: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<{
    passwordReset: true;
  }> {
    const email = input.email.trim().toLowerCase();

    if (!/^\d{6}$/.test(input.code)) {
      throw new BadRequestException(
        'Verification code must contain exactly 6 digits',
      );
    }

    if (input.newPassword.length < 10) {
      throw new BadRequestException('Password must be at least 10 characters');
    }

    const passwordHash = await this.passwords.hash(input.newPassword);

    await this.dataSource.transaction(async (manager) => {
      const user = await this.users.findByEmail(email, manager);

      if (!user) {
        throw new BadRequestException(
          'Verification code is invalid or expired',
        );
      }

      await this.otp.verifyCode(
        {
          email,

          purpose: 'reset_password',

          code: input.code,
        },
        manager,
      );

      await this.users.updatePasswordHash(user, passwordHash, manager);

      await this.refreshTokens.revokeAllForUser(
        user.id,
        'password_reset',
        manager,
      );
    });

    return {
      passwordReset: true,
    };
  }
}
