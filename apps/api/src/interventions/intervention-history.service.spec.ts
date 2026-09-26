import { InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { RedisService } from '../redis/redis.service.js';

import { InterventionHistoryService } from './intervention-history.service.js';
import { INTERVENTION_EVENT_TYPE } from './intervention.publisher.js';

function createRedis(entries: Array<[string, string[]]>): RedisService {
  return {
    client: {
      xrange: vi.fn().mockResolvedValue(entries),
    },
  } as unknown as RedisService;
}

describe('InterventionHistoryService', () => {
  it('reads intervention history from the meeting Redis stream', async () => {
    const meetingId = '22222222-2222-4222-8222-222222222222';

    const payload = {
      id: 'intervention-1',

      gapId: 'gap-1',

      meetingId,

      sprintItemId: '11111111-1111-4111-8111-111111111111',

      observationId: 'observation-1',

      reason: 'missing_owner',

      message: "Got it — who's taking this one?",

      createdAt: '2026-09-26T18:00:00.000Z',
    };

    const redis = createRedis([
      [
        '1790431200000-0',
        [
          'event_type',
          INTERVENTION_EVENT_TYPE,

          'event_id',
          payload.id,

          'payload',
          JSON.stringify(payload),
        ],
      ],
    ]);

    const service = new InterventionHistoryService(redis);

    const result = await service.listByMeeting(meetingId);

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual({
      streamId: '1790431200000-0',

      intervention: {
        ...payload,

        createdAt: new Date(payload.createdAt),
      },
    });

    expect(redis.client.xrange).toHaveBeenCalledWith(
      `lumos:meeting:{${meetingId}}:interventions`,
      '-',
      '+',
    );
  });

  it('ignores unsupported events in the intervention stream', async () => {
    const meetingId = '22222222-2222-4222-8222-222222222222';

    const redis = createRedis([
      [
        '1790431200000-0',
        ['event_type', 'unsupported.event.v1', 'payload', '{}'],
      ],
    ]);

    const service = new InterventionHistoryService(redis);

    const result = await service.listByMeeting(meetingId);

    expect(result).toEqual([]);
  });

  it('rejects malformed intervention history payloads', async () => {
    const meetingId = '22222222-2222-4222-8222-222222222222';

    const redis = createRedis([
      [
        '1790431200000-0',
        [
          'event_type',
          INTERVENTION_EVENT_TYPE,

          'payload',
          JSON.stringify({
            id: 'intervention-1',

            meetingId,
          }),
        ],
      ],
    ]);

    const service = new InterventionHistoryService(redis);

    await expect(service.listByMeeting(meetingId)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
