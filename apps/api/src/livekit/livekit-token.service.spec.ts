import { ConfigService } from '@nestjs/config';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  Env,
} from '../config/env.js';

import { MeetingsService } from '../meetings/meetings.service.js';

import { LiveKitTokenService } from './livekit-token.service.js';

describe('LiveKitTokenService', () => {
  it(
    'creates a token and starts the requested meeting',
    async () => {
      const meetingId =
        '90c7bb9d-de11-496f-ab54-beb2fed1f5db';

      const meeting = {
        id: meetingId,
        roomName: meetingId,
        status: 'created' as const,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      const activeMeeting = {
        ...meeting,
        status: 'active' as const,
        startedAt: new Date(),
      };

      const configValues:
        Record<string, string> = {
        LIVEKIT_URL:
          'wss://example.livekit.cloud',

        LIVEKIT_API_KEY:
          'test-api-key',

        LIVEKIT_API_SECRET:
          'test-api-secret-test-api-secret',
      };

      const config = {
        get: vi.fn(
          (key: string) =>
            configValues[key],
        ),
      } as unknown as ConfigService<
        Env,
        true
      >;

      const meetingsService = {
        getById:
          vi.fn()
            .mockResolvedValue(
              meeting,
            ),

        start:
          vi.fn()
            .mockResolvedValue(
              activeMeeting,
            ),
      } as unknown as MeetingsService;

      const service =
        new LiveKitTokenService(
          config,
          meetingsService,
        );

      const result =
        await service
          .createConnectionDetails(
            meetingId,
          );

      expect(
        meetingsService.getById,
      ).toHaveBeenCalledWith(
        meetingId,
      );

      expect(
        meetingsService.start,
      ).toHaveBeenCalledWith(
        meetingId,
      );

      expect(
        result.meetingId,
      ).toBe(
        meetingId,
      );

      expect(
        result.roomName,
      ).toBe(
        meetingId,
      );

      expect(
        result.serverUrl,
      ).toBe(
        'wss://example.livekit.cloud',
      );

      expect(
        result.participantIdentity,
      ).toMatch(
        /^participant_/,
      );

      expect(
        result.participantToken,
      ).toBeTruthy();
    },
  );
});
