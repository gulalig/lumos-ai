import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthPrincipal } from '../auth/auth-principal.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RefreshCookieService } from '../auth/refresh-cookie.service.js';

import { OnboardingService } from './onboarding.service.js';

interface CreateWorkspaceBody {
  name: string;
}

@Controller('auth/onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  public constructor(
    private readonly onboarding: OnboardingService,

    private readonly refreshCookies: RefreshCookieService,
  ) {}

  @Post('workspace')
  @HttpCode(HttpStatus.CREATED)
  public async createWorkspace(
    @CurrentUser()
    principal: AuthPrincipal,

    @Body()
    body: CreateWorkspaceBody,

    @Req()
    request: FastifyRequest,

    @Res({
      passthrough: true,
    })
    reply: FastifyReply,
  ) {
    if (principal.workspaceId || principal.workspaceMemberId) {
      throw new BadRequestException(
        'Workspace onboarding has already been completed',
      );
    }

    const refreshToken = this.refreshCookies.read(request);

    if (!refreshToken) {
      throw new BadRequestException('Refresh session is required');
    }

    const result = await this.onboarding.createWorkspace({
      userId: principal.userId,

      refreshToken,

      workspaceName: body.name,
    });

    this.refreshCookies.set(reply, result.refreshToken);

    const {
      refreshToken: _refreshToken,

      refreshTokenExpiresAt: _refreshTokenExpiresAt,

      ...response
    } = result;

    return response;
  }
}
