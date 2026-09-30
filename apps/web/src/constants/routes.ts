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
    workflow: "/onboarding/workflow",
    integration: "/onboarding/integration",
  },

  app: {
    dashboard: "/app/dashboard",
    demo: "/app/demo",
    meetings: "/app/meetings",
    sprint: "/app/sprint",
    activity: "/app/activity",
    integrations: "/app/integrations",
    settings: "/app/settings",
  },

  admin: {
    login: "/admin/login",
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
