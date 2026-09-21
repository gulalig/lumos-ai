import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';

import type {
  Env,
} from '../config/env.js';

import { MeetingsService } from '../meetings/meetings.service.js';

import type {
  LiveKitConnectionDetails,
} from './livekit.types.js';

const TOKEN_TTL = '10m';

@Injectable()
export class LiveKitTokenService {
  constructor(
    private readonly config:
    ConfigService<Env, true>,

    private readonly meetingsService:
    MeetingsService,
  ) {}

  async createConnectionDetails(
    meetingId: string,
  ): Promise<LiveKitConnectionDetails> {
    // Read first so we know the LiveKit transport
    // identity before creating the token.
    const meeting =
      await this.meetingsService.getById(
        meetingId,
      );

    const serverUrl =
      this.config.get(
        'LIVEKIT_URL',
        {
          infer: true,
        },
      );

    const apiKey =
      this.config.get(
        'LIVEKIT_API_KEY',
        {
          infer: true,
        },
      );

    const apiSecret =
      this.config.get(
        'LIVEKIT_API_SECRET',
        {
          infer: true,
        },
      );

    const participantIdentity =
      `participant_${randomUUID()}`;

    const accessToken =
      new AccessToken(
        apiKey,
        apiSecret,
        {
          identity:
          participantIdentity,

          ttl:
          TOKEN_TTL,
        },
      );

    accessToken.addGrant({
      roomJoin: true,

      room:
      meeting.roomName,

      canPublish: true,
      canSubscribe: false,
      canPublishData: false,
    });

    // Prepare the JWT before changing meeting
    // lifecycle state.
    const participantToken =
      await accessToken.toJwt();

    // Only after token preparation succeeds do
    // we transition the meeting to active and
    // emit meeting.started.v1.
    const activeMeeting =
      await this.meetingsService.start(
        meetingId,
      );

    return {
      serverUrl,

      meetingId:
      activeMeeting.id,

      roomName:
      activeMeeting.roomName,

      participantIdentity,

      participantToken,
    };
  }
}
