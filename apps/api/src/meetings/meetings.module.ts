import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';

import { InterventionsModule } from '../interventions/interventions.module.js';

import { RedisModule } from '../redis/redis.module.js';

import { UsageModule } from '../usage/usage.module.js';

import { MeetingParticipantEntity } from './meeting-participant.entity.js';
import { MeetingEntity } from './meeting.entity.js';

import { MeetingLifecyclePublisher } from './meeting-lifecycle.publisher.js';
import { MeetingParticipantsRepository } from './meeting-participants.repository.js';
import { MeetingParticipantsService } from './meeting-participants.service.js';
import { MeetingSnapshotService } from './meeting-snapshot.service.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsRepository } from './meetings.repository.js';
import { MeetingsService } from './meetings.service.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([MeetingEntity, MeetingParticipantEntity]),

    AuthModule,
    RedisModule,
    InterventionsModule,
    UsageModule,
    RateLimitModule,
  ],

  controllers: [MeetingsController],

  providers: [
    MeetingsRepository,
    MeetingParticipantsRepository,

    MeetingLifecyclePublisher,

    MeetingParticipantsService,
    MeetingSnapshotService,
    MeetingsService,
  ],

  exports: [MeetingsRepository, MeetingsService, MeetingParticipantsService],
})
export class MeetingsModule {}
