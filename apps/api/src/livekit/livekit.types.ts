import { z } from 'zod';

export const createLiveKitTokenRequestSchema = z
  .object({
    meetingId: z.uuid(),

    workspaceMemberId: z.uuid(),
  })
  .strict();

export interface LiveKitConnectionDetails {
  serverUrl: string;

  meetingId: string;
  roomName: string;

  participantIdentity: string;
  participantName: string;

  participantToken: string;
}
