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

import { InterventionHistoryService } from '../interventions/intervention-history.service.js';

import { UsageControlService } from '../usage/usage-control.service.js';

import { MeetingSnapshotService } from './meeting-snapshot.service.js';
import { MeetingsService } from './meetings.service.js';

import type { MeetingSnapshot } from './meeting-snapshot.types.js';

import type { CreateMeetingResult, Meeting } from './meeting.types.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';

@Controller('meetings')
export class MeetingsController {
  public constructor(
    private readonly meetingsService: MeetingsService,

    private readonly snapshotService: MeetingSnapshotService,

    private readonly interventionHistory: InterventionHistoryService,

    private readonly usage: UsageControlService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({
    namespace: 'meeting-create',

    scope: 'user',

    limit: 20,

    windowSeconds: 60,
  })
  public async createMeeting(
    @CurrentUser()
    principal: AuthPrincipal,
  ): Promise<CreateMeetingResult> {
    const workspaceId = this.requireWorkspaceId(principal);

    await this.usage.assertMeetingCreationAllowed(workspaceId);

    const meeting = await this.meetingsService.create();

    await this.meetingsService.bindWorkspace(meeting.meetingId, workspaceId);

    return meeting;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listMeetings(
    @CurrentUser()
    principal: AuthPrincipal,
  ): Promise<Meeting[]> {
    const workspaceId = this.requireWorkspaceId(principal);

    return this.meetingsService.listForWorkspace(workspaceId);
  }

  @Get(':meetingId')
  @UseGuards(JwtAuthGuard)
  public async getMeeting(
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
  public async getMeetingSnapshot(
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
  public async endMeeting(
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

  @Get(':meetingId/interventions')
  @UseGuards(JwtAuthGuard)
  public async getMeetingInterventions(
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

  private requireWorkspaceId(principal: AuthPrincipal): string {
    if (!principal.workspaceId) {
      throw new BadRequestException('Workspace membership is required');
    }

    return principal.workspaceId;
  }
}
