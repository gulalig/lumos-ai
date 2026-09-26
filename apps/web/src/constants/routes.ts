export const ROUTES = {
  home: "/",

  auth: {
    login: "/login",
    signup: "/signup",
    verifyEmail: "/verify-email",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
  },

  onboarding: {
    workspace: "/onboarding/workspace",
    integration: "/onboarding/integration",
    project: "/onboarding/project",
  },

  app: {
    dashboard: "/app/dashboard",
    meetings: "/app/meetings",
    sprint: "/app/sprint",
    activity: "/app/activity",
    integrations: "/app/integrations",
    settings: "/app/settings",
  },

  admin: {
    dashboard: "/admin/dashboard",
    users: "/admin/users",
    workspaces: "/admin/workspaces",
    integrations: "/admin/integrations",
    system: "/admin/system",
  },

  dev: {
    meeting: "/dev/meeting",
  },
} as const;
