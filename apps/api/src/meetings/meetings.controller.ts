import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthPrincipal } from '../auth/auth-principal.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { MeetingSnapshotService } from './meeting-snapshot.service.js';
import { MeetingsService } from './meetings.service.js';

import type { MeetingSnapshot } from './meeting-snapshot.types.js';

import type { CreateMeetingResult, Meeting } from './meeting.types.js';
import { InterventionHistoryService } from '../interventions/intervention-history.service.js';

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,

    private readonly snapshotService: MeetingSnapshotService,
    private readonly interventionHistory: InterventionHistoryService,
  ) {}

  @Post()
  async createMeeting(): Promise<CreateMeetingResult> {
    return this.meetingsService.create();
  }

  @Get(':meetingId')
  @UseGuards(JwtAuthGuard)
  async getMeeting(
    @CurrentUser()
    principal: AuthPrincipal,

    @Param(
      'meetingId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    meetingId: string,
  ): Promise<Meeting> {
    const workspaceId = this.requireWorkspaceId(principal);

    return this.meetingsService.getByIdForWorkspace(meetingId, workspaceId);
  }

  @Get(':meetingId/snapshot')
  @UseGuards(JwtAuthGuard)
  async getMeetingSnapshot(
    @CurrentUser()
    principal: AuthPrincipal,

    @Param(
      'meetingId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    meetingId: string,
  ): Promise<MeetingSnapshot> {
    const workspaceId = this.requireWorkspaceId(principal);

    return this.snapshotService.getSnapshot(meetingId, workspaceId);
  }

  @Post(':meetingId/end')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async endMeeting(
    @CurrentUser()
    principal: AuthPrincipal,

    @Param(
      'meetingId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    meetingId: string,
  ): Promise<Meeting> {
    const workspaceId = this.requireWorkspaceId(principal);

    await this.meetingsService.getByIdForWorkspace(meetingId, workspaceId);

    return this.meetingsService.end(meetingId);
  }

  private requireWorkspaceId(principal: AuthPrincipal): string {
    if (!principal.workspaceId) {
      throw new BadRequestException('Workspace membership is required');
    }

    return principal.workspaceId;
  }

  @Get(':meetingId/interventions')
  @UseGuards(JwtAuthGuard)
  async getMeetingInterventions(
    @CurrentUser()
    principal: AuthPrincipal,

    @Param(
      'meetingId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    meetingId: string,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    await this.meetingsService.getByIdForWorkspace(meetingId, workspaceId);

    return this.interventionHistory.listByMeeting(meetingId);
  }
}
