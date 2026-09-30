import { API_CONFIG } from "@/constants/api";

export interface MeetingSnapshotItem {
  id: string;

  kind: "decision" | "commitment" | "proposal" | "question";

  evidenceEventId: string;

  evidenceText: string;

  summary: string;

  owner?: string | null;

  dueText?: string | null;

  explicit: boolean;

  confidence: number;
}

export interface MeetingTranscriptItem {
  id: string;

  participantId: string;

  text: string;

  capturedAt: string;

  turnOrder: number;
}

export interface MeetingSnapshot {
  meetingId: string;

  status: "created" | "active" | "ended";

  version?: number;

  transcript: MeetingTranscriptItem[];

  decisions: MeetingSnapshotItem[];

  commitments: MeetingSnapshotItem[];

  proposals: MeetingSnapshotItem[];

  questions: MeetingSnapshotItem[];
}

const API_BASE_URL = API_CONFIG.baseUrl;

export async function getMeetingSnapshot(
  meetingId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<MeetingSnapshot> {
  const response = await fetch(
    `${API_BASE_URL}/meetings/${meetingId}/snapshot`,
    {
      method: "GET",

      headers: {
        Accept: "application/json",

        Authorization: `Bearer ${accessToken}`,
      },

      cache: "no-store",

      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to load meeting snapshot: ${response.status}`);
  }

  return (await response.json()) as MeetingSnapshot;
}
