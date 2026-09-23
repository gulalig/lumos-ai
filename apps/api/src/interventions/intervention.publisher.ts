import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';

import { interventionGapId } from './intervention-gap.js';
import type {
  Intervention,
  InterventionReason,
} from './intervention.js';

export const INTERVENTION_EVENT_TYPE = 'intervention.requested.v1';

export const INTERVENTION_COOLDOWN_MS = 60_000;

export type InterventionPublishResult =
  | {
  status: 'published';
  streamId: string;
}
  | {
  status: 'duplicate';
  streamId: string;
}
  | {
  status: 'suppressed';
  streamId: null;
}
  | {
  status: 'resolved';
  streamId: null;
};

const PUBLISH_SCRIPT = `
local existing = redis.call(
  'GET',
  KEYS[2]
)

if existing then
  return 'duplicate:' .. existing
end

local resolvedAt = redis.call(
  'HGET',
  KEYS[3],
  'resolved_at_ms'
)

if resolvedAt then
  return 'resolved'
end

local lastAskedAt = redis.call(
  'HGET',
  KEYS[3],
  'last_asked_at_ms'
)

local nowMs = tonumber(ARGV[4])
local cooldownMs = tonumber(ARGV[5])

if lastAskedAt then
  local elapsed =
    nowMs -
    tonumber(lastAskedAt)

  if elapsed < cooldownMs then
    return 'suppressed'
  end
end

local streamId = redis.call(
  'XADD',
  KEYS[1],
  '*',
  'event_type',
  ARGV[1],
  'event_id',
  ARGV[2],
  'payload',
  ARGV[3]
)

redis.call(
  'SET',
  KEYS[2],
  streamId
)

redis.call(
  'HINCRBY',
  KEYS[3],
  'asked_count',
  1
)

redis.call(
  'HSET',
  KEYS[3],
  'last_asked_at_ms',
  ARGV[4],
  'gap_id',
  ARGV[6],
  'reason',
  ARGV[7],
  'sprint_item_id',
  ARGV[8]
)

return 'published:' .. streamId
`;

const RESOLVE_SCRIPT = `
local exists = redis.call(
  'EXISTS',
  KEYS[1]
)

if exists == 0 then
  return 0
end

local resolvedAt = redis.call(
  'HGET',
  KEYS[1],
  'resolved_at_ms'
)

if resolvedAt then
  return 0
end

redis.call(
  'HSET',
  KEYS[1],
  'resolved_at_ms',
  ARGV[1],
  'resolved_observation_id',
  ARGV[2]
)

return 1
`;

@Injectable()
export class InterventionPublisher {
  constructor(
    private readonly redis: RedisService,
  ) {}

  async publish(
    intervention: Intervention,
  ): Promise<InterventionPublishResult> {
    const streamKey = this.streamKey(
      intervention.meetingId,
    );

    const dedupeKey = this.dedupeKey(
      intervention.meetingId,
      intervention.id,
    );

    const stateKey = this.stateKey(
      intervention.meetingId,
      intervention.gapId,
    );

    const result = await this.redis.client.eval(
      PUBLISH_SCRIPT,
      3,
      streamKey,
      dedupeKey,
      stateKey,
      INTERVENTION_EVENT_TYPE,
      intervention.id,
      JSON.stringify(intervention),
      String(Date.now()),
      String(INTERVENTION_COOLDOWN_MS),
      intervention.gapId,
      intervention.reason,
      intervention.sprintItemId,
    );

    if (typeof result !== 'string') {
      throw new Error(
        'Intervention publish returned invalid result',
      );
    }

    if (result === 'suppressed') {
      return {
        status: 'suppressed',
        streamId: null,
      };
    }

    if (result === 'resolved') {
      return {
        status: 'resolved',
        streamId: null,
      };
    }

    if (result.startsWith('published:')) {
      return {
        status: 'published',
        streamId: result.slice(
          'published:'.length,
        ),
      };
    }

    if (result.startsWith('duplicate:')) {
      return {
        status: 'duplicate',
        streamId: result.slice(
          'duplicate:'.length,
        ),
      };
    }

    throw new Error(
      `Intervention publish returned unknown result: ${result}`,
    );
  }

  async resolveGap(
    meetingId: string,
    sprintItemId: string,
    reason: InterventionReason,
    observationId: string,
    resolvedAt: Date,
  ): Promise<boolean> {
    const gapId = interventionGapId(
      sprintItemId,
      reason,
    );

    const stateKey = this.stateKey(
      meetingId,
      gapId,
    );

    const result = await this.redis.client.eval(
      RESOLVE_SCRIPT,
      1,
      stateKey,
      String(resolvedAt.getTime()),
      observationId,
    );

    return result === 1;
  }

  private streamKey(
    meetingId: string,
  ): string {
    return (
      `lumos:meeting:{${meetingId}}:` +
      'interventions'
    );
  }

  private dedupeKey(
    meetingId: string,
    interventionId: string,
  ): string {
    return (
      `lumos:meeting:{${meetingId}}:` +
      `intervention:${interventionId}:stream-id`
    );
  }

  private stateKey(
    meetingId: string,
    gapId: string,
  ): string {
    return (
      `lumos:meeting:{${meetingId}}:` +
      `intervention-gap:${gapId}`
    );
  }
}
