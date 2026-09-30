export type DashboardSprintStatus =
  "planned" | "active" | "completed" | "cancelled";

export type DashboardExecutionStatus =
  "todo" | "in_progress" | "blocked" | "done" | "cancelled";

export type DashboardMeetingStatus = "created" | "active" | "ended";

export type DashboardInterventionReason = "missing_owner" | "missing_due_date";

export type DashboardJiraStatus =
  "not_synced" | "pending" | "processing" | "synced" | "error";

export interface DashboardSummary {
  executionItems: number;
  needsAttention: number;
  resolvedInterventions: number;
  completedItems: number;
}

export interface DashboardSprint {
  id: string;
  name: string;
  goal: string | null;
  status: DashboardSprintStatus;
  startsAt: string | null;
  endsAt: string | null;
}

export interface DashboardJiraState {
  status: DashboardJiraStatus;
  issueKey: string | null;
  issueId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface DashboardExecutionItem {
  id: string;
  title: string;
  description: string | null;
  status: DashboardExecutionStatus;
  ownerWorkspaceMemberId: string | null;
  dueAt: string | null;
  blockerText: string | null;
  acceptanceCriteria: string[];
  missingOwner: boolean;
  missingDueDate: boolean;
  jira: DashboardJiraState;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMeeting {
  id: string;
  roomName: string;
  status: DashboardMeetingStatus;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface DashboardIntervention {
  id: string;
  gapId: string;
  meetingId: string;
  sprintItemId: string;
  observationId: string;
  reason: DashboardInterventionReason;
  message: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt: string | null;
}

export interface DashboardOverviewResponse {
  summary: DashboardSummary;
  activeSprint: DashboardSprint | null;
  executionItems: DashboardExecutionItem[];
  recentMeetings: DashboardMeeting[];
  recentInterventions: DashboardIntervention[];
}
