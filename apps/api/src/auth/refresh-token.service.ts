import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';

import type { Env } from '../config/env.js';

import { AuthRefreshSessionsRepository } from './auth-refresh-sessions.repository.js';

export interface CreatedRefreshToken {
  refreshToken: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken {
  userId: string;
  workspaceMemberId: string | null;
  refreshToken: string;
  expiresAt: Date;
}

type RotateTransactionResult =
  | {
      status: 'ok';
      value: RotatedRefreshToken;
    }
  | {
      status: 'expired';
    }
  | {
      status: 'reuse';
    };

@Injectable()
export class RefreshTokenService {
  private readonly ttlDays: number;

  public constructor(
    private readonly dataSource: DataSource,

    private readonly sessions: AuthRefreshSessionsRepository,

    config: ConfigService<Env, true>,
  ) {
    this.ttlDays = config.get('AUTH_REFRESH_TTL_DAYS', {
      infer: true,
    });
  }

  public async create(input: {
    userId: string;
    workspaceMemberId: string | null;
  }): Promise<CreatedRefreshToken> {
    const refreshToken = this.generateToken();

    const now = new Date();

    const expiresAt = this.calculateExpiry(now);

    await this.sessions.create({
      id: randomUUID(),

      familyId: randomUUID(),

      userId: input.userId,

      workspaceMemberId: input.workspaceMemberId,

      tokenHash: this.hashToken(refreshToken),

      expiresAt,

      rotatedFromId: null,
    });

    return {
      refreshToken,
      expiresAt,
    };
  }

  public async rotate(refreshToken: string): Promise<RotatedRefreshToken> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(refreshToken);

    const result = await this.dataSource.transaction<RotateTransactionResult>(
      async (manager) => {
        const session = await this.sessions.findByTokenHashForUpdate(
          tokenHash,
          manager,
        );

        if (!session) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        const now = new Date();

        if (session.revokedAt) {
          await this.sessions.revokeFamily(
            session.familyId,
            now,
            'refresh_token_reuse',
            manager,
          );

          return {
            status: 'reuse',
          };
        }

        if (session.expiresAt.getTime() <= now.getTime()) {
          session.revokedAt = now;

          session.revokeReason = 'expired';

          session.lastUsedAt = now;

          await this.sessions.save(session, manager);

          return {
            status: 'expired',
          };
        }

        session.revokedAt = now;

        session.revokeReason = 'rotated';

        session.lastUsedAt = now;

        await this.sessions.save(session, manager);

        const nextRefreshToken = this.generateToken();

        const nextExpiresAt = this.calculateExpiry(now);

        await this.sessions.create(
          {
            id: randomUUID(),

            familyId: session.familyId,

            userId: session.userId,

            workspaceMemberId: session.workspaceMemberId,

            tokenHash: this.hashToken(nextRefreshToken),

            expiresAt: nextExpiresAt,

            rotatedFromId: session.id,
          },
          manager,
        );

        return {
          status: 'ok',

          value: {
            userId: session.userId,

            workspaceMemberId: session.workspaceMemberId,

            refreshToken: nextRefreshToken,

            expiresAt: nextExpiresAt,
          },
        };
      },
    );

    if (result.status === 'reuse') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (result.status === 'expired') {
      throw new UnauthorizedException('Refresh token expired');
    }

    return result.value;
  }

  public async revoke(refreshToken: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const tokenHash = this.hashToken(refreshToken);

    await this.dataSource.transaction(async (manager) => {
      const session = await this.sessions.findByTokenHashForUpdate(
        tokenHash,
        manager,
      );

      if (!session || session.revokedAt) {
        return;
      }

      session.revokedAt = new Date();

      session.revokeReason = 'logout';

      session.lastUsedAt = new Date();

      await this.sessions.save(session, manager);
    });
  }

  public async revokeAllForUser(
    userId: string,
    reason: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.sessions.revokeAllForUser(userId, new Date(), reason, manager);
  }

  private generateToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private calculateExpiry(from: Date): Date {
    return new Date(from.getTime() + this.ttlDays * 24 * 60 * 60 * 1000);
  }
}
