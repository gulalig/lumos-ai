import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

import type { Env } from '../config/env.js';
import type { ResolvedMemberIdentity } from '../identity/identity.service.js';

import { MeetingParticipantsService } from '../meetings/meeting-participants.service.js';
import { MeetingsService } from '../meetings/meetings.service.js';

import type { LiveKitConnectionDetails } from './livekit.types.js';

const TOKEN_TTL = '10m';

@Injectable()
export class LiveKitTokenService {
  constructor(
    private readonly config: ConfigService<Env, true>,

    private readonly meetingsService: MeetingsService,

    private readonly meetingParticipantsService: MeetingParticipantsService,
  ) {}

  async createConnectionDetails(
    meetingId: string,
    identity: ResolvedMemberIdentity,
  ): Promise<LiveKitConnectionDetails> {
    const meeting = await this.meetingsService.bindWorkspace(
      meetingId,
      identity.workspaceId,
    );

    const participant = await this.meetingParticipantsService.ensureMember(
      meetingId,
      identity,
    );

    const serverUrl = this.config.get('LIVEKIT_URL', {
      infer: true,
    });

    const apiKey = this.config.get('LIVEKIT_API_KEY', {
      infer: true,
    });

    const apiSecret = this.config.get('LIVEKIT_API_SECRET', {
      infer: true,
    });

    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: participant.livekitIdentity,

      name: participant.displayName,

      // metadata: JSON.stringify({
      //   workspaceId: identity.workspaceId,
      //
      //   workspaceMemberId: identity.workspaceMemberId,
      //
      //   userId: identity.userId,
      //
      //   displayName: identity.displayName,
      //
      //   role: identity.role,
      //
      //   jobTitle: identity.jobTitle,
      //
      //   teamName: identity.teamName,
      // }),

      ttl: TOKEN_TTL,
    });

    accessToken.addGrant({
      roomJoin: true,

      room: meeting.roomName,

      canPublish: true,

      canSubscribe: true,

      canPublishData: false,
    });

    const participantToken = await accessToken.toJwt();

    const activeMeeting = await this.meetingsService.start(meetingId);

    return {
      serverUrl,

      meetingId: activeMeeting.id,

      roomName: activeMeeting.roomName,

      participantIdentity: participant.livekitIdentity,

      participantName: participant.displayName,

      participantToken,
    };
  }
}
