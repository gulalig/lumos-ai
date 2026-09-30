import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module.js';

import { RateLimitGuard } from './rate-limit.guard.js';

@Module({
  imports: [RedisModule],

  providers: [RateLimitGuard],

  exports: [RateLimitGuard],
})
export class RateLimitModule {}
