export interface AdminOverviewSummary {
  totalUsers: number;
  totalWorkspaces: number;
  activeWorkspaces: number;
  totalMeetings: number;
  jiraConnectedWorkspaces: number;
  recentSignups: number;
}

export interface AdminRecentUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AdminRecentWorkspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
}

export interface AdminOverview {
  summary: AdminOverviewSummary;

  recentUsers: AdminRecentUser[];

  recentWorkspaces: AdminRecentWorkspace[];

  jira: {
    connected: number;
    pending: number;
    error: number;
  };
}

export interface AdminUserMembership {
  workspaceId: string;
  workspaceName: string;
  role: "owner" | "admin" | "member";
}

export interface AdminUserListItem {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: string;
  memberships: AdminUserMembership[];
}

export type AdminWorkspaceJiraStatus =
  "not_configured" | "pending" | "connected" | "error";

export interface AdminWorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  createdAt: string;

  owner: {
    userId: string;
    displayName: string;
    email: string;
  } | null;

  memberCount: number;
  meetingCount: number;

  jira: {
    status: AdminWorkspaceJiraStatus;
    siteName: string | null;
    projectKey: string | null;
    projectName: string | null;
    lastError: string | null;
  };
}

export type AdminIntegrationStatus = "pending" | "connected" | "error";

export interface AdminIntegrationListItem {
  id: string;

  workspace: {
    id: string;
    name: string;
    slug: string;
  };

  status: AdminIntegrationStatus;

  site: {
    name: string | null;
    url: string | null;
  };

  project: {
    id: string | null;
    key: string | null;
    name: string | null;
  };

  accessTokenExpiresAt: string | null;
  lastError: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface AdminIntegrationsResponse {
  summary: {
    total: number;
    connected: number;
    pending: number;
    error: number;
  };

  integrations: AdminIntegrationListItem[];
}

export interface AdminSystemStatus {
  health: {
    postgres: "up" | "down";
    redis: "up" | "down";
    overall: "healthy" | "degraded";
  };

  jiraSync: {
    pending: number;
    processing: number;
    completed: number;
    retried: number;
  };

  recentErrors: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string | null;
    sprintItemId: string;
    attempts: number;
    lastError: string;
    updatedAt: string;
  }>;
}

export interface AdminWorkspaceUsage {
  workspaceId: string;

  enabled: boolean;

  trialEndsAt: string | null;

  trialExpired: boolean;

  monthlyMeetingLimit: number | null;

  meetingsThisMonth: number;

  meetingCreationEnabled: boolean;

  livekitEnabled: boolean;

  disabledReason: string | null;
}

export interface UpdateAdminWorkspaceUsageRequest {
  enabled: boolean;

  trialEndsAt: string | null;

  monthlyMeetingLimit: number | null;

  meetingCreationEnabled: boolean;

  livekitEnabled: boolean;

  disabledReason: string | null;
}
