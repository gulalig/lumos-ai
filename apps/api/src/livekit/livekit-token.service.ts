import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

import type { Env } from '../config/env.js';
import type { ResolvedMemberIdentity } from '../identity/identity.service.js';

import { MeetingParticipantsService } from '../meetings/meeting-participants.service.js';
import { MeetingsService } from '../meetings/meetings.service.js';

import type {
  DemoActor,
  DemoLiveKitConnectionDetails,
  LiveKitConnectionDetails,
} from './livekit.types.js';

const TOKEN_TTL = '10m';

const DEMO_ACTORS: Record<
  DemoActor,
  {
    identity: string;
    name: string;
  }
> = {
  alex: {
    identity: 'demo:alex',
    name: 'Alex',
  },

  maya: {
    identity: 'demo:maya',
    name: 'Maya',
  },
};

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

  async createDemoActorConnectionDetails(
    meetingId: string,
    workspaceId: string,
    actor: DemoActor,
  ): Promise<DemoLiveKitConnectionDetails> {
    const meeting = await this.meetingsService.bindWorkspace(
      meetingId,
      workspaceId,
    );

    const actorConfig = DEMO_ACTORS[actor];

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
      identity: actorConfig.identity,

      name: actorConfig.name,

      metadata: JSON.stringify({
        type: 'demo-actor',

        actor,

        displayName: actorConfig.name,
      }),

      ttl: TOKEN_TTL,
    });

    accessToken.addGrant({
      roomJoin: true,

      room: meeting.roomName,

      canPublish: true,

      // Receive the runtime's reliable floor replies before starting audio.
      canSubscribe: true,

      // Demo audio obtains a runtime floor grant before starting each WAV.
      canPublishData: true,
    });

    const participantToken = await accessToken.toJwt();

    return {
      serverUrl,

      meetingId: meeting.id,

      roomName: meeting.roomName,

      actor,

      participantIdentity: actorConfig.identity,

      participantName: actorConfig.name,

      participantToken,
    };
  }
}
