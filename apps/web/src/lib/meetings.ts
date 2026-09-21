export type MeetingStatus =
  | 'created'
  | 'active'
  | 'ended';

export interface CreateMeetingResult {
  meetingId: string;
  roomName: string;
  status: MeetingStatus;
}

export interface Meeting {
  id: string;
  roomName: string;
  status: MeetingStatus;

  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api/v1';

export async function createMeeting(
  signal?: AbortSignal,
): Promise<CreateMeetingResult> {
  const response = await fetch(
    `${API_BASE_URL}/meetings`,
    {
      method: 'POST',

      headers: {
        Accept: 'application/json',
      },

      cache: 'no-store',
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to create meeting: ${response.status}`,
    );
  }

  return await response.json() as CreateMeetingResult;
}

export async function endMeeting(
  meetingId: string,
  signal?: AbortSignal,
): Promise<Meeting> {
  const response = await fetch(
    `${API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}/end`,
    {
      method: 'POST',

      headers: {
        Accept: 'application/json',
      },

      cache: 'no-store',
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to end meeting: ${response.status}`,
    );
  }

  return await response.json() as Meeting;
}
