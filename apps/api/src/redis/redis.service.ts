import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  readonly client: Redis;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.client = new Redis(
      this.config.get('REDIS_URL', {
        infer: true,
      }),
      {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      },
    );
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();

    const response = await this.client.ping();

    if (response !== 'PONG') {
      throw new Error('Redis health check failed');
    }

    this.logger.log('Redis connection established');
  }

  async isHealthy(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();

    this.logger.log('Redis connection closed');
  }
}
