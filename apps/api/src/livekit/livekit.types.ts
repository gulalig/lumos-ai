import { z } from 'zod';

export const createLiveKitTokenRequestSchema = z
  .object({
    meetingId: z.uuid(),
  })
  .strict();

export const demoActorSchema = z.enum(['alex', 'maya']);

export type DemoActor = z.infer<typeof demoActorSchema>;

export const createDemoLiveKitTokenRequestSchema = z
  .object({
    meetingId: z.uuid(),

    actor: demoActorSchema,
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

export interface DemoLiveKitConnectionDetails {
  serverUrl: string;

  meetingId: string;
  roomName: string;

  actor: DemoActor;

  participantIdentity: string;
  participantName: string;

  participantToken: string;
}
