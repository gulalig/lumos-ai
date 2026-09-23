export interface LiveKitConnectionDetails {
  serverUrl: string;
  meetingId: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  participantToken: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

const DEV_WORKSPACE_MEMBER_ID = "33333333-3333-4333-8333-333333333333";

export async function getLiveKitConnectionDetails(
  meetingId: string,
  signal?: AbortSignal,
): Promise<LiveKitConnectionDetails> {
  const response = await fetch(`${API_BASE_URL}/livekit/token`, {
    method: "POST",

    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      meetingId,
      workspaceMemberId: DEV_WORKSPACE_MEMBER_ID,
    }),

    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain LiveKit token: ${response.status}`);
  }

  return (await response.json()) as LiveKitConnectionDetails;
}
