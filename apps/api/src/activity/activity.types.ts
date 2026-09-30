export type ActivityType =
  | 'meeting_created'
  | 'meeting_started'
  | 'meeting_ended'
  | 'execution_created'
  | 'execution_updated'
  | 'intervention_requested'
  | 'intervention_resolved'
  | 'jira_queued'
  | 'jira_synced'
  | 'jira_failed';

export type ActivityCategory =
  'meeting' | 'execution' | 'intervention' | 'jira';

export type ActivityTone =
  'neutral' | 'active' | 'success' | 'warning' | 'error';

export interface ActivityEntry {
  id: string;

  type: ActivityType;

  category: ActivityCategory;

  tone: ActivityTone;

  title: string;

  description: string | null;

  occurredAt: Date;

  meetingId: string | null;

  sprintItemId: string | null;

  jiraIssueKey: string | null;
}

export interface ActivityFeed {
  activities: ActivityEntry[];

  summary: {
    total: number;
    meetings: number;
    resolvedInterventions: number;
    jiraSynced: number;
  };
}
