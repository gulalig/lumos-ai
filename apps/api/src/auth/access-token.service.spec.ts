import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';

import { AccessTokenService } from './access-token.service.js';

function createFixture() {
  const jwt = {
    signAsync: vi.fn(async () => 'signed-jwt'),
  } as unknown as JwtService;

  const config = {
    get: vi.fn((key: keyof Env) => {
      if (key === 'JWT_ACCESS_SECRET') {
        return 'a'.repeat(48);
      }

      if (key === 'JWT_ACCESS_EXPIRES_IN') {
        return '15m';
      }

      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService<Env, true>;

  const service = new AccessTokenService(jwt, config);

  return {
    service,
    jwt,
  };
}

describe('AccessTokenService', () => {
  it('creates a JWT containing only user and active membership identity', async () => {
    const fixture = createFixture();

    const result = await fixture.service.create({
      userId: 'user-1',

      workspaceMemberId: 'member-1',
    });

    expect(fixture.jwt.signAsync).toHaveBeenCalledWith(
      {
        sub: 'user-1',

        workspaceMemberId: 'member-1',
      },
      {
        secret: 'a'.repeat(48),

        expiresIn: 900,
      },
    );

    expect(result).toEqual({
      accessToken: 'signed-jwt',

      expiresInSeconds: 900,
    });
  });

  it('supports users that have not completed workspace onboarding yet', async () => {
    const fixture = createFixture();

    await fixture.service.create({
      userId: 'user-1',

      workspaceMemberId: null,
    });

    expect(fixture.jwt.signAsync).toHaveBeenCalledWith(
      {
        sub: 'user-1',

        workspaceMemberId: null,
      },
      expect.objectContaining({
        expiresIn: 900,
      }),
    );
  });
});
