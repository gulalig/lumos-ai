export type MeetingSnapshotStatus =
  | 'created'
  | 'active'
  | 'ended';

export type MeetingSnapshotKind =
  | 'decision'
  | 'commitment'
  | 'proposal'
  | 'question';

export interface MeetingSnapshotItem {
  id: string;

  kind: MeetingSnapshotKind;

  evidenceEventId: string;
  evidenceText: string;

  summary: string;

  owner: string;
  dueText: string;

  explicit: boolean;
  confidence: number;
}

export interface MeetingSnapshot {
  meetingId: string;

  status: MeetingSnapshotStatus;

  version: number;

  decisions: MeetingSnapshotItem[];
  commitments: MeetingSnapshotItem[];
  proposals: MeetingSnapshotItem[];
  questions: MeetingSnapshotItem[];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api/v1';

export async function getMeetingSnapshot(
  meetingId: string,
  signal?: AbortSignal,
): Promise<MeetingSnapshot> {
  const response = await fetch(
    `${API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}/snapshot`,
    {
      method: 'GET',

      headers: {
        Accept: 'application/json',
      },

      cache: 'no-store',
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load meeting snapshot: ${response.status}`,
    );
  }

  return await response.json() as MeetingSnapshot;
}
