import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { FastifyRequest } from 'fastify';

import type { AuthPrincipal } from './auth-principal.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const request = context.switchToHttp().getRequest<
      FastifyRequest & {
        user: AuthPrincipal;
      }
    >();

    return request.user;
  },
);
