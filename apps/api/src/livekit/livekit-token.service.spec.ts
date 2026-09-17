import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Env } from '../config/env.js';
import { LiveKitTokenService } from './livekit-token.service.js';

describe('LiveKitTokenService', () => {
  let service: LiveKitTokenService;

  beforeEach(() => {
    const values: Env = {
      NODE_ENV: 'test',
      API_PORT: 3001,
      DATABASE_URL: 'postgresql://test',
      REDIS_URL: 'redis://localhost:6379',
      LIVEKIT_URL: 'wss://test.livekit.cloud',
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-secret',
      LIVEKIT_ROOM: 'lumos-test',
      WEB_ORIGIN: 'http://localhost:3000',
    };

    const config = {
      get: (key: keyof Env) => values[key],
    } as ConfigService<Env, true>;

    service = new LiveKitTokenService(config);
  });

  it('creates scoped connection details', async () => {
    const result = await service.createConnectionDetails();

    expect(result.serverUrl).toBe(
      'wss://test.livekit.cloud',
    );

    expect(result.roomName).toBe('lumos-test');

    expect(result.participantIdentity).toMatch(
      /^participant_/,
    );

    expect(result.participantToken).toBeTruthy();
  });

  it('creates a unique participant identity per request', async () => {
    const first = await service.createConnectionDetails();
    const second = await service.createConnectionDetails();

    expect(first.participantIdentity).not.toBe(
      second.participantIdentity,
    );
  });
});
