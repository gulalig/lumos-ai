import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const database = {
    isHealthy: vi.fn(),
  } as unknown as DatabaseService;

  const redis = {
    isHealthy: vi.fn(),
  } as unknown as RedisService;

  const controller = new HealthController(database, redis);

  it('should return liveness status', () => {
    expect(controller.getLiveness()).toEqual({
      status: 'ok',
      service: 'lumos-api',
    });
  });

  it('should return readiness status when dependencies are healthy', async () => {
    vi.mocked(database.isHealthy).mockResolvedValue(true);
    vi.mocked(redis.isHealthy).mockResolvedValue(true);

    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ready',
      service: 'lumos-api',
      dependencies: {
        postgres: 'up',
        redis: 'up',
      },
    });
  });
});
