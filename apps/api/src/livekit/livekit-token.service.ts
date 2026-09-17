import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';

import type { Env } from '../config/env.js';
import type { LiveKitConnectionDetails } from './livekit.types.js';

const TOKEN_TTL = '10m';

@Injectable()
export class LiveKitTokenService {
  constructor(
    private readonly config: ConfigService<Env, true>,
  ) {}

  async createConnectionDetails(): Promise<LiveKitConnectionDetails> {
    const serverUrl = this.config.get('LIVEKIT_URL', {
      infer: true,
    });

    const apiKey = this.config.get('LIVEKIT_API_KEY', {
      infer: true,
    });

    const apiSecret = this.config.get('LIVEKIT_API_SECRET', {
      infer: true,
    });

    const roomName = this.config.get('LIVEKIT_ROOM', {
      infer: true,
    });

    const participantIdentity = `participant_${randomUUID()}`;

    const accessToken = new AccessToken(
      apiKey,
      apiSecret,
      {
        identity: participantIdentity,
        ttl: TOKEN_TTL,
      },
    );

    accessToken.addGrant({
      roomJoin: true,
      room: roomName,

      canPublish: true,
      canSubscribe: false,
      canPublishData: false,
    });

    const participantToken = await accessToken.toJwt();

    return {
      serverUrl,
      roomName,
      participantIdentity,
      participantToken,
    };
  }
}
