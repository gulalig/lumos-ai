import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';

import type { ResolvedMemberIdentity } from '../identity/identity.service.js';

import { MeetingParticipantsService } from '../meetings/meeting-participants.service.js';
import { MeetingsService } from '../meetings/meetings.service.js';

import { LiveKitTokenService } from './livekit-token.service.js';

describe('LiveKitTokenService', () => {
  it.each(['alex', 'maya'] as const)(
    'allows demo %s to send floor requests and receive runtime replies',
    async (actor) => {
      const configValues: Record<string, string> = {
        LIVEKIT_URL: 'wss://example.livekit.cloud',
        LIVEKIT_API_KEY: 'test-api-key',
        LIVEKIT_API_SECRET: 'test-api-secret-test-api-secret',
      };
      const config = {
        get: vi.fn((key: string) => configValues[key]),
      } as unknown as ConfigService<Env, true>;
      const meetings = {
        bindWorkspace: vi.fn().mockResolvedValue({
          id: 'meeting',
          roomName: 'meeting',
        }),
      } as unknown as MeetingsService;
      const service = new LiveKitTokenService(
        config,
        meetings,
        {} as MeetingParticipantsService,
      );
      const details = await service.createDemoActorConnectionDetails(
        'meeting',
        'workspace',
        actor,
      );
      const claims = JSON.parse(
        Buffer.from(
          details.participantToken.split('.')[1]!,
          'base64url',
        ).toString('utf8'),
      );
      expect(claims.sub).toBe('demo:' + actor);
      expect(claims.video).toMatchObject({
        roomJoin: true,
        room: 'meeting',
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
    },
  );

  it('creates a token using the resolved workspace member identity', async () => {
    const meetingId = '90c7bb9d-de11-496f-ab54-beb2fed1f5db';

    const workspaceId = 'd5b1b1ea-6851-4aad-842d-f3f820a95c59';

    const workspaceMemberId = '710bd6cf-722e-422a-ac81-26fd941d416f';

    const userId = '59c8d55b-d001-46ea-a434-7639241ca178';

    const identity: ResolvedMemberIdentity = {
      workspaceMemberId,
      workspaceId,
      userId,

      displayName: 'Alice Smith',

      email: 'alice@example.com',

      role: 'member',

      jobTitle: 'Engineer',

      teamName: 'Platform',

      livekitIdentity: `member:${workspaceMemberId}`,
    };

    const meeting = {
      id: meetingId,

      roomName: meetingId,

      workspaceId,

      status: 'created' as const,

      createdAt: new Date(),

      startedAt: null,

      endedAt: null,
    };

    const activeMeeting = {
      ...meeting,

      status: 'active' as const,

      startedAt: new Date(),
    };

    const participant = {
      id: 'de7b60c7-a9d1-437d-893d-e3ed79e28119',

      meetingId,

      workspaceMemberId,

      participantType: 'member' as const,

      displayName: identity.displayName,

      livekitIdentity: identity.livekitIdentity,

      joinedAt: new Date(),

      leftAt: null,

      createdAt: new Date(),

      meeting: meeting,

      workspaceMember: null,
    };

    const configValues: Record<string, string> = {
      LIVEKIT_URL: 'wss://example.livekit.cloud',

      LIVEKIT_API_KEY: 'test-api-key',

      LIVEKIT_API_SECRET: 'test-api-secret-test-api-secret',
    };

    const config = {
      get: vi.fn((key: string) => configValues[key]),
    } as unknown as ConfigService<Env, true>;

    const meetingsService = {
      bindWorkspace: vi.fn().mockResolvedValue(meeting),

      start: vi.fn().mockResolvedValue(activeMeeting),
    } as unknown as MeetingsService;

    const meetingParticipantsService = {
      ensureMember: vi.fn().mockResolvedValue(participant),
    } as unknown as MeetingParticipantsService;

    const service = new LiveKitTokenService(
      config,
      meetingsService,
      meetingParticipantsService,
    );

    const result = await service.createConnectionDetails(meetingId, identity);

    expect(meetingsService.bindWorkspace).toHaveBeenCalledWith(
      meetingId,
      workspaceId,
    );

    expect(meetingParticipantsService.ensureMember).toHaveBeenCalledWith(
      meetingId,
      identity,
    );

    expect(meetingsService.start).toHaveBeenCalledWith(meetingId);

    expect(result.meetingId).toBe(meetingId);

    expect(result.roomName).toBe(meetingId);

    expect(result.serverUrl).toBe('wss://example.livekit.cloud');

    expect(result.participantIdentity).toBe(`member:${workspaceMemberId}`);

    expect(result.participantName).toBe('Alice Smith');

    expect(result.participantToken).toBeTruthy();
  });
});
