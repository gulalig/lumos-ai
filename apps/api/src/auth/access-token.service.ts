import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { Env } from '../config/env.js';

import type { AccessTokenPayload } from './auth-principal.js';

export interface CreateAccessTokenInput {
  userId: string;
  workspaceMemberId: string | null;
}

export interface CreatedAccessToken {
  accessToken: string;
  expiresInSeconds: number;
}

@Injectable()
export class AccessTokenService {
  private readonly secret: string;

  private readonly expiresInSeconds: number;

  public constructor(
    private readonly jwt: JwtService,

    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('JWT_ACCESS_SECRET', {
      infer: true,
    });

    this.expiresInSeconds = this.parseDurationSeconds(
      config.get('JWT_ACCESS_EXPIRES_IN', {
        infer: true,
      }),
    );
  }

  public async create(
    input: CreateAccessTokenInput,
  ): Promise<CreatedAccessToken> {
    const payload: AccessTokenPayload = {
      sub: input.userId,

      workspaceMemberId: input.workspaceMemberId,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.secret,

      expiresIn: this.expiresInSeconds,
    });

    return {
      accessToken,

      expiresInSeconds: this.expiresInSeconds,
    };
  }

  private parseDurationSeconds(value: string): number {
    const normalized = value.trim().toLowerCase();

    const match = /^(\d+)(s|m|h|d)$/.exec(normalized);

    if (!match) {
      throw new Error(
        'JWT_ACCESS_EXPIRES_IN must use s, m, h, or d, for example 15m',
      );
    }

    const amount = Number.parseInt(match[1], 10);

    const unit = match[2];

    const multiplier =
      unit === 's'
        ? 1
        : unit === 'm'
          ? 60
          : unit === 'h'
            ? 60 * 60
            : 24 * 60 * 60;

    return amount * multiplier;
  }
}
