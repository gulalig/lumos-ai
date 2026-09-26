import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module.js';

import { InterventionHistoryService } from './intervention-history.service.js';
import { InterventionPublisher } from './intervention.publisher.js';
import { InterventionService } from './intervention.service.js';

@Module({
  imports: [RedisModule],

  providers: [
    InterventionService,
    InterventionPublisher,
    InterventionHistoryService,
  ],

  exports: [
    InterventionService,
    InterventionPublisher,
    InterventionHistoryService,
  ],
})
export class InterventionsModule {}
