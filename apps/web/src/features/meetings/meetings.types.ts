export type MeetingStatus = "created" | "active" | "ended";

export interface MeetingListItem {
  id: string;
  roomName: string;
  status: MeetingStatus;
  workspaceId: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export type MeetingSnapshotKind =
  "decision" | "commitment" | "proposal" | "question";

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

  status: MeetingStatus;

  version: number;

  decisions: MeetingSnapshotItem[];

  commitments: MeetingSnapshotItem[];

  proposals: MeetingSnapshotItem[];

  questions: MeetingSnapshotItem[];
}

export type InterventionReason = "missing_owner" | "missing_due_date";

export interface MeetingIntervention {
  streamId: string;

  id: string;

  gapId: string;

  meetingId: string;

  sprintItemId: string;

  observationId: string;

  reason: InterventionReason;

  message: string;

  createdAt: string;

  resolved: boolean;

  resolvedAt: string | null;

  resolvedObservationId: string | null;
}

export interface MeetingDetailResponse {
  meeting: MeetingListItem;

  snapshot: MeetingSnapshot;

  interventions: MeetingIntervention[];
}
