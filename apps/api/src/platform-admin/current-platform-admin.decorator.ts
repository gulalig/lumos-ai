import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { PlatformAdminPrincipal } from './platform-admin-principal.js';

export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PlatformAdminPrincipal => {
    const request = context.switchToHttp().getRequest<{
      user: PlatformAdminPrincipal;
    }>();

    return request.user;
  },
);
