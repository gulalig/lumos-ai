import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { LiveKitTokenService } from './livekit-token.service.js';

import {
  createLiveKitTokenRequestSchema,
} from './livekit.types.js';

import type {
  LiveKitConnectionDetails,
} from './livekit.types.js';

@Controller('livekit')
export class LiveKitController {
  constructor(
    private readonly liveKitTokenService: LiveKitTokenService,
  ) {}

  @Post('token')
  @HttpCode(HttpStatus.CREATED)
  async createToken(
    @Body() body: unknown,
  ): Promise<LiveKitConnectionDetails> {
    const parsed =
      createLiveKitTokenRequestSchema.safeParse(
        body,
      );

    if (!parsed.success) {
      throw new BadRequestException(
        'meetingId must be a valid UUID',
      );
    }

    return this.liveKitTokenService
      .createConnectionDetails(
        parsed.data.meetingId,
      );
  }
}
