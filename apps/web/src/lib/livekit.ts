import { API_CONFIG } from "@/constants/api";

export interface LiveKitConnectionDetails {
  serverUrl: string;

  meetingId: string;
  roomName: string;

  participantIdentity: string;
  participantName: string;

  participantToken: string;
}

export type DemoActor = "alex" | "maya";

export interface DemoLiveKitConnectionDetails {
  serverUrl: string;

  meetingId: string;
  roomName: string;

  actor: DemoActor;

  participantIdentity: string;
  participantName: string;

  participantToken: string;
}

const API_BASE_URL = API_CONFIG.baseUrl;

export async function getLiveKitConnectionDetails(
  meetingId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<LiveKitConnectionDetails> {
  const response = await fetch(`${API_BASE_URL}/livekit/token`, {
    method: "POST",

    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },

    body: JSON.stringify({
      meetingId,
    }),

    cache: "no-store",

    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain LiveKit token: ${response.status}`);
  }

  return (await response.json()) as LiveKitConnectionDetails;
}

export async function getDemoLiveKitConnectionDetails(
  meetingId: string,
  actor: DemoActor,
  accessToken: string,
  signal?: AbortSignal,
): Promise<DemoLiveKitConnectionDetails> {
  const response = await fetch(`${API_BASE_URL}/livekit/demo-token`, {
    method: "POST",

    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },

    body: JSON.stringify({
      meetingId,
      actor,
    }),

    cache: "no-store",

    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to obtain demo participant token: ${response.status}`,
    );
  }

  return (await response.json()) as DemoLiveKitConnectionDetails;
}
