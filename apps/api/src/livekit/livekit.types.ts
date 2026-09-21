import { z } from 'zod';

export const createLiveKitTokenRequestSchema = z
  .object({
    meetingId: z
      .string()
      .uuid(),
  })
  .strict();

export type CreateLiveKitTokenRequest =
  z.infer<typeof createLiveKitTokenRequestSchema>;

export interface LiveKitConnectionDetails {
  serverUrl: string;
  meetingId: string;
  roomName: string;
  participantIdentity: string;
  participantToken: string;
}
