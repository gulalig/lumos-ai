import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { MeetingSnapshotService } from './meeting-snapshot.service.js';
import { MeetingsService } from './meetings.service.js';

import type {
  MeetingSnapshot,
} from './meeting-snapshot.types.js';

import type {
  CreateMeetingResult,
  Meeting,
} from './meeting.types.js';

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingsService:
    MeetingsService,

    private readonly snapshotService:
    MeetingSnapshotService,
  ) {}

  @Post()
  async createMeeting():
    Promise<CreateMeetingResult> {
    return this.meetingsService
      .create();
  }

  @Get(':meetingId')
  async getMeeting(
    @Param('meetingId')
    meetingId: string,
  ): Promise<Meeting> {
    return this.meetingsService
      .getById(
        meetingId,
      );
  }

  @Get(':meetingId/snapshot')
  async getMeetingSnapshot(
    @Param('meetingId')
    meetingId: string,
  ): Promise<MeetingSnapshot> {
    return this.snapshotService
      .getSnapshot(
        meetingId,
      );
  }

  @Post(':meetingId/end')
  @HttpCode(HttpStatus.OK)
  async endMeeting(
    @Param('meetingId')
    meetingId: string,
  ): Promise<Meeting> {
    return this.meetingsService
      .end(
        meetingId,
      );
  }
}
