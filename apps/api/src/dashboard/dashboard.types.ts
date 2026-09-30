import type { MeetingStatus } from '../meetings/meeting.entity.js';
import type { SprintItemStatus } from '../sprints/entities/sprint-item.entity.js';
import type { SprintStatus } from '../sprints/entities/sprint.entity.js';
import type { InterventionReason } from '../interventions/intervention.js';

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
  status: SprintStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface DashboardJiraState {
  status: 'not_synced' | 'pending' | 'processing' | 'synced' | 'error';

  issueKey: string | null;
  issueId: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
}

export interface DashboardExecutionItem {
  id: string;
  title: string;
  description: string | null;
  status: SprintItemStatus;
  ownerWorkspaceMemberId: string | null;
  dueAt: Date | null;
  blockerText: string | null;
  acceptanceCriteria: string[];

  missingOwner: boolean;
  missingDueDate: boolean;

  jira: DashboardJiraState;

  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardMeeting {
  id: string;
  roomName: string;
  status: MeetingStatus;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

export interface DashboardIntervention {
  id: string;
  gapId: string;
  meetingId: string;
  sprintItemId: string;
  observationId: string;
  reason: InterventionReason;
  message: string;
  createdAt: Date;

  resolved: boolean;
  resolvedAt: Date | null;
}

export interface DashboardOverview {
  summary: DashboardSummary;

  activeSprint: DashboardSprint | null;

  executionItems: DashboardExecutionItem[];

  recentMeetings: DashboardMeeting[];

  recentInterventions: DashboardIntervention[];
}
