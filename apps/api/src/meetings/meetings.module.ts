import { Module } from '@nestjs/common';

import { MeetingLifecyclePublisher } from './meeting-lifecycle.publisher.js';
import { MeetingSnapshotService } from './meeting-snapshot.service.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsRepository } from './meetings.repository.js';
import { MeetingsService } from './meetings.service.js';

@Module({
  controllers: [
    MeetingsController,
  ],

  providers: [
    MeetingsRepository,
    MeetingLifecyclePublisher,
    MeetingSnapshotService,
    MeetingsService,
  ],

  exports: [
    MeetingsService,
  ],
})
export class MeetingsModule {}
