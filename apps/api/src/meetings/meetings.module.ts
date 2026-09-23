import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MeetingParticipantEntity } from './meeting-participant.entity.js';
import { MeetingEntity } from './meeting.entity.js';
import { MeetingLifecyclePublisher } from './meeting-lifecycle.publisher.js';
import { MeetingParticipantsRepository } from './meeting-participants.repository.js';
import { MeetingParticipantsService } from './meeting-participants.service.js';
import { MeetingSnapshotService } from './meeting-snapshot.service.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsRepository } from './meetings.repository.js';
import { MeetingsService } from './meetings.service.js';

@Module({
  imports: [
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

  exports: [
    MeetingsRepository,
    MeetingsService,
    MeetingParticipantsService,
  ],
})
export class MeetingsModule {}
