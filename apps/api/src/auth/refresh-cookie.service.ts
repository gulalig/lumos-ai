import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Env } from '../config/env.js';

const REFRESH_COOKIE_NAME = 'lumos_refresh_token';

@Injectable()
export class RefreshCookieService {
  private readonly secure: boolean;

  private readonly ttlDays: number;

  public constructor(config: ConfigService<Env, true>) {
    this.secure =
      config.get('NODE_ENV', {
        infer: true,
      }) === 'production' ||
      config.get('API_PUBLIC_URL', { infer: true })?.startsWith('https://') ===
        true;

    this.ttlDays = config.get('AUTH_REFRESH_TTL_DAYS', {
      infer: true,
    });
  }

  public read(request: FastifyRequest): string | null {
    return request.cookies?.[REFRESH_COOKIE_NAME] ?? null;
  }

  public set(reply: FastifyReply, token: string): void {
    reply.setCookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,

      secure: this.secure,

      sameSite: 'lax',

      path: '/api/v1/auth',

      maxAge: this.ttlDays * 24 * 60 * 60,
    });
  }

  public clear(reply: FastifyReply): void {
    reply.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,

      secure: this.secure,

      sameSite: 'lax',

      path: '/api/v1/auth',
    });
  }
}
