import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthPrincipal } from '../auth/auth-principal.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { IdentityService } from '../identity/identity.service.js';

import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';

import { UsageControlService } from '../usage/usage-control.service.js';

import { LiveKitTokenService } from './livekit-token.service.js';

import {
  createDemoLiveKitTokenRequestSchema,
  createLiveKitTokenRequestSchema,
  type DemoLiveKitConnectionDetails,
  type LiveKitConnectionDetails,
} from './livekit.types.js';

@Controller('livekit')
export class LiveKitController {
  public constructor(
    private readonly liveKitTokenService: LiveKitTokenService,

    private readonly identityService: IdentityService,

    private readonly usage: UsageControlService,
  ) {}

  @Post('token')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({
    namespace: 'livekit-token',

    scope: 'user',

    limit: 30,

    windowSeconds: 60,
  })
  public async createToken(
    @CurrentUser()
    principal: AuthPrincipal,

    @Body()
    body: unknown,
  ): Promise<LiveKitConnectionDetails> {
    const parsed = createLiveKitTokenRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException('meetingId must be a valid UUID');
    }

    if (!principal.workspaceMemberId || !principal.workspaceId) {
      throw new BadRequestException('Workspace membership is required');
    }

    await this.usage.assertLiveKitAllowed(principal.workspaceId);

    const identity = await this.identityService.resolveMember(
      principal.workspaceMemberId,
    );

    if (
      identity.userId !== principal.userId ||
      identity.workspaceId !== principal.workspaceId
    ) {
      throw new BadRequestException(
        'Workspace membership does not match the authenticated user',
      );
    }

    return this.liveKitTokenService.createConnectionDetails(
      parsed.data.meetingId,
      identity,
    );
  }

  @Post('demo-token')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({
    namespace: 'livekit-demo-token',

    scope: 'user',

    limit: 10,

    windowSeconds: 60,
  })
  public async createDemoToken(
    @CurrentUser()
    principal: AuthPrincipal,

    @Body()
    body: unknown,
  ): Promise<DemoLiveKitConnectionDetails> {
    const parsed = createDemoLiveKitTokenRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(
        'meetingId must be a valid UUID and actor must be alex or maya',
      );
    }

    if (!principal.workspaceMemberId || !principal.workspaceId) {
      throw new BadRequestException('Workspace membership is required');
    }

    await this.usage.assertLiveKitAllowed(principal.workspaceId);

    const identity = await this.identityService.resolveMember(
      principal.workspaceMemberId,
    );

    if (
      identity.userId !== principal.userId ||
      identity.workspaceId !== principal.workspaceId
    ) {
      throw new BadRequestException(
        'Workspace membership does not match the authenticated user',
      );
    }

    return this.liveKitTokenService.createDemoActorConnectionDetails(
      parsed.data.meetingId,
      principal.workspaceId,
      parsed.data.actor,
    );
  }
}
