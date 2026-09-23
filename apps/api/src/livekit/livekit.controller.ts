import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { IdentityService } from '../identity/identity.service.js';

import { LiveKitTokenService } from './livekit-token.service.js';
import { createLiveKitTokenRequestSchema } from './livekit.types.js';

import type { LiveKitConnectionDetails } from './livekit.types.js';

@Controller('livekit')
export class LiveKitController {
  constructor(
    private readonly liveKitTokenService: LiveKitTokenService,

    private readonly identityService: IdentityService,
  ) {}

  @Post('token')
  async createToken(
    @Body()
    body: unknown,
  ): Promise<LiveKitConnectionDetails> {
    const parsed = createLiveKitTokenRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(
        'meetingId and workspaceMemberId must be valid UUIDs',
      );
    }

    const identity = await this.identityService.resolveMember(
      parsed.data.workspaceMemberId,
    );

    return this.liveKitTokenService.createConnectionDetails(
      parsed.data.meetingId,
      identity,
    );
  }
}
