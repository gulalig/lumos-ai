import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';

import { MeetingParticipantEntity } from './meeting-participant.entity.js';
import { MeetingEntity } from './meeting.entity.js';
import { MeetingLifecyclePublisher } from './meeting-lifecycle.publisher.js';
import { MeetingParticipantsRepository } from './meeting-participants.repository.js';
import { MeetingParticipantsService } from './meeting-participants.service.js';
import { MeetingSnapshotService } from './meeting-snapshot.service.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsRepository } from './meetings.repository.js';
import { MeetingsService } from './meetings.service.js';
import { InterventionsModule } from '../interventions/interventions.module.js';

@Module({
  imports: [
    AuthModule,
    InterventionsModule,

    TypeOrmModule.forFeature([MeetingEntity, MeetingParticipantEntity]),
  ],

  controllers: [MeetingsController],

  providers: [
    MeetingsRepository,
    MeetingParticipantsRepository,

    MeetingLifecyclePublisher,
    MeetingSnapshotService,

    MeetingsService,
    MeetingParticipantsService,
  ],

  exports: [MeetingsRepository, MeetingsService, MeetingParticipantsService],
})
export class MeetingsModule {}
