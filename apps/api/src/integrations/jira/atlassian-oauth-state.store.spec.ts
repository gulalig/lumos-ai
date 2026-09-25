import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Env } from '../../config/env.js';
import { RedisService } from '../../redis/redis.service.js';

import { AtlassianOAuthStateStore } from './atlassian-oauth-state.store.js';

function createRedisService(): RedisService {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  const config = {
    get: (name: keyof Env) => {
      if (name === 'REDIS_URL') {
        return redisUrl;
      }

      throw new Error(`unexpected config key ${name}`);
    },
  } as unknown as ConfigService<Env, true>;

  return new RedisService(config);
}

describe('AtlassianOAuthStateStore', () => {
  let redis: RedisService;
  let store: AtlassianOAuthStateStore;

  beforeAll(async () => {
    redis = createRedisService();

    await redis.onModuleInit();

    store = new AtlassianOAuthStateStore(redis);
  });

  afterAll(async () => {
    if (redis.client.status === 'ready') {
      await redis.client.quit();
    }
  });

  it('creates and consumes state exactly once', async () => {
    const state = await store.create('workspace-1');

    expect(state.length).toBeGreaterThan(20);

    await expect(store.consume(state)).resolves.toBe('workspace-1');

    await expect(store.consume(state)).resolves.toBeNull();
  });
});
