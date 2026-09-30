import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { FastifyRequest } from 'fastify';

import type { AuthPrincipal } from '../auth/auth-principal.js';

import { RedisService } from '../redis/redis.service.js';

import {
  RATE_LIMIT_METADATA,
  type RateLimitOptions,
} from './rate-limit.decorator.js';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthPrincipal;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,

    private readonly redis: RedisService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RATE_LIMIT_METADATA, [context.getHandler(), context.getClass()]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const identity = this.resolveIdentity(request, options);

    const key = this.createKey(options.namespace, options.scope, identity);

    const count = await this.increment(key, options.windowSeconds);

    if (count > options.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,

          error: 'Too Many Requests',

          message: 'Too many requests. Please try again later.',
        },

        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveIdentity(
    request: AuthenticatedRequest,
    options: RateLimitOptions,
  ): string {
    if (options.scope === 'user') {
      const userId = request.user?.userId;

      if (userId) {
        return userId;
      }

      // This is only a fallback.
      // User-scoped endpoints should place
      // JwtAuthGuard before RateLimitGuard.
      return request.ip;
    }

    return request.ip;
  }

  private createKey(
    namespace: string,
    scope: string,
    identity: string,
  ): string {
    return ['lumos', 'rate-limit', namespace, scope, identity].join(':');
  }

  private async increment(key: string, windowSeconds: number): Promise<number> {
    const script = `
      local current =
        redis.call(
          'INCR',
          KEYS[1]
        )

      if current == 1 then
        redis.call(
          'EXPIRE',
          KEYS[1],
          ARGV[1]
        )
      end

      return current
    `;

    const result = await this.redis.client.eval(
      script,
      1,
      key,
      windowSeconds.toString(),
    );

    return Number(result);
  }
}
