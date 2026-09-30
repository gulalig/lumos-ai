import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { Env } from '../config/env.js';

import type { PlatformAdminAccessTokenPayload } from './platform-admin-principal.js';

@Injectable()
export class PlatformAdminAccessTokenService {
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

  public async create(adminId: string) {
    const payload: PlatformAdminAccessTokenPayload = {
      sub: adminId,

      kind: 'platform_admin',
    };

    return {
      accessToken: await this.jwt.signAsync(payload, {
        secret: this.secret,

        expiresIn: this.expiresInSeconds,
      }),

      expiresInSeconds: this.expiresInSeconds,
    };
  }

  private parseDurationSeconds(value: string): number {
    const normalized = value.trim().toLowerCase();

    const match = /^(\d+)(s|m|h|d)$/.exec(normalized);

    if (!match) {
      throw new Error('JWT_ACCESS_EXPIRES_IN must use s, m, h, or d');
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
