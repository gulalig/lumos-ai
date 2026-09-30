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

export interface MeetingTranscriptItem {
  id: string;

  participantId: string;

  text: string;

  capturedAt: string;

  turnOrder: number;
}

export interface MeetingSnapshot {
  meetingId: string;

  status: 'created' | 'active' | 'ended';

  version: number;

  transcript: MeetingTranscriptItem[];

  decisions: MeetingSnapshotItem[];
  commitments: MeetingSnapshotItem[];
  proposals: MeetingSnapshotItem[];
  questions: MeetingSnapshotItem[];
}
