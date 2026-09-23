import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { InterventionPublisher } from './intervention.publisher.js';
import { InterventionService } from './intervention.service.js';

@Module({
  imports: [RedisModule],

  providers: [
    InterventionService,
    InterventionPublisher,
  ],

  exports: [
    InterventionService,
    InterventionPublisher,
  ],
})
export class InterventionsModule {}
