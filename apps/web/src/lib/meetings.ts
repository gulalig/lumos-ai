import { API_CONFIG } from "@/constants/api";

export interface CreateMeetingResult {
  meetingId: string;
  roomName: string;
  status: "created" | "active" | "ended";
}

const API_BASE_URL = API_CONFIG.baseUrl;

export async function createMeeting(
  accessToken: string,
  signal?: AbortSignal,
): Promise<CreateMeetingResult> {
  const response = await fetch(`${API_BASE_URL}/meetings`, {
    method: "POST",

    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },

    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : `Failed to create meeting: ${response.status}`;

    throw new Error(message);
  }

  return (await response.json()) as CreateMeetingResult;
}

export async function endMeeting(
  meetingId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/end`, {
    method: "POST",

    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },

    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : `Failed to end meeting: ${response.status}`;

    throw new Error(message);
  }
}
