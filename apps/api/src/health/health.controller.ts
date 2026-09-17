import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  getLiveness() {
    return {
      status: 'ok',
      service: 'lumos-api',
    };
  }

  @Get('ready')
  async getReadiness() {
    const [postgres, redis] = await Promise.all([
      this.database.isHealthy(),
      this.redis.isHealthy(),
    ]);

    if (!postgres || !redis) {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        postgres,
        redis,
      });
    }

    return {
      status: 'ready',
      service: 'lumos-api',
      dependencies: {
        postgres: 'up',
        redis: 'up',
      },
    };
  }
}
