export type MeetingStatus =
  | 'created'
  | 'active'
  | 'ended';

export interface Meeting {
  id: string;
  roomName: string;
  status: MeetingStatus;

  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

export interface CreateMeetingInput {
  id: string;
  roomName: string;
}

export interface CreateMeetingResult {
  meetingId: string;
  roomName: string;
  status: MeetingStatus;
}
