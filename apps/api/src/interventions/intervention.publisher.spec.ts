import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RedisService } from '../redis/redis.service.js';

import { interventionGapId } from './intervention-gap.js';
import { InterventionPublisher } from './intervention.publisher.js';
import { InterventionService } from './intervention.service.js';

describe('InterventionPublisher integration', () => {
  let redis: Redis;
  let publisher: InterventionPublisher;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');

    await redis.ping();

    publisher = new InterventionPublisher({
      client: redis,
    } as RedisService);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('resolves an existing missing-owner gap after ownership is supplied', async () => {
    const meetingId = '44444444-4444-4444-8444-444444444444';

    const sprintItemId = '11111111-1111-4111-8111-111111111111';

    const firstObservationId = 'observation-ownerless';

    const refinedObservationId = 'observation-owner-added';

    const service = new InterventionService();

    const interventions = service.evaluate({
      meetingId,
      sprintItemId,

      observation: {
        id: firstObservationId,

        kind: 'commitment',

        evidenceEventId: 'evidence-ownerless',

        evidenceText: 'Prepare the deployment checklist.',

        summary: 'Prepare the deployment checklist',

        explicit: true,

        confidence: 0.95,
      },

      ownerWorkspaceMemberId: null,

      dueAt: new Date('2026-09-25T23:59:59.999Z'),

      createdAt: new Date('2026-09-24T01:00:00.000Z'),
    });

    expect(interventions).toHaveLength(1);

    const intervention = interventions[0];

    expect(intervention.reason).toBe('missing_owner');

    const gapId = interventionGapId(sprintItemId, 'missing_owner');

    expect(intervention.gapId).toBe(gapId);

    const stateKey =
      `lumos:meeting:{${meetingId}}:` + `intervention-gap:${gapId}`;

    const streamKey = `lumos:meeting:{${meetingId}}:` + 'interventions';

    const dedupeKey =
      `lumos:meeting:{${meetingId}}:` +
      `intervention:${intervention.id}:stream-id`;

    await redis.del(stateKey, streamKey, dedupeKey);

    const publishResult = await publisher.publish(intervention);

    expect(publishResult.status).toBe('published');

    const openState = await redis.hgetall(stateKey);

    expect(openState).toMatchObject({
      gap_id: gapId,

      reason: 'missing_owner',

      sprint_item_id: sprintItemId,

      asked_count: '1',
    });

    expect(openState.resolved_at_ms).toBeUndefined();

    const resolvedAt = new Date('2026-09-24T01:01:00.000Z');

    const resolved = await publisher.resolveGap(
      meetingId,
      sprintItemId,
      'missing_owner',
      refinedObservationId,
      resolvedAt,
    );

    expect(resolved).toBe(true);

    const resolvedState = await redis.hgetall(stateKey);

    expect(resolvedState.resolved_at_ms).toBe(String(resolvedAt.getTime()));

    expect(resolvedState.resolved_observation_id).toBe(refinedObservationId);

    const afterResolution = await publisher.publish({
      ...intervention,

      id: 'different-request-id',

      observationId: refinedObservationId,

      createdAt: new Date('2026-09-24T01:02:00.000Z'),
    });

    expect(afterResolution.status).toBe('resolved');

    await redis.del(
      stateKey,
      streamKey,
      dedupeKey,

      `lumos:meeting:{${meetingId}}:` +
        'intervention:different-request-id:stream-id',
    );
  });
});
