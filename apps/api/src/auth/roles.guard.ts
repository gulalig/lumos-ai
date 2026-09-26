import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { WorkspaceMemberRole } from '../identity/entities/workspace-member.entity.js';

import type { AuthPrincipal } from './auth-principal.js';
import { AUTH_ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      WorkspaceMemberRole[]
    >(AUTH_ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthPrincipal;
    }>();

    const principal = request.user;

    if (
      !principal ||
      !principal.workspaceMemberId ||
      !principal.workspaceId ||
      !principal.role
    ) {
      throw new ForbiddenException('Workspace membership is required');
    }

    if (!requiredRoles.includes(principal.role)) {
      throw new ForbiddenException('Insufficient workspace permissions');
    }

    return true;
  }
}
