import { baseApi } from "./base-api";

export interface JiraAuthorizeResponse {
  url: string;
}

export type JiraSetupState =
  | "authorization_required"
  | "site_selection_required"
  | "project_selection_required"
  | "connected";

export interface JiraSite {
  cloudId: string;
  name: string | null;
  url: string | null;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraSetupResponse {
  workspaceId: string;
  state: JiraSetupState;
  status: string;

  site: JiraSite | null;

  project: JiraProject | null;

  lastError: string | null;
}

export interface JiraAccessibleSite {
  id: string;
  name: string;
  url: string;
}

export interface SelectJiraSiteRequest {
  cloudId: string;
}

export interface SelectJiraProjectRequest {
  projectId: string;
  projectKey: string;
  projectName: string;
}

export const jiraApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getJiraSetup: builder.query<JiraSetupResponse, void>({
      query: () => ({
        url: "/integrations/jira/setup",
        method: "GET",
      }),

      providesTags: ["Jira"],
    }),

    beginJiraOAuth: builder.mutation<JiraAuthorizeResponse, void>({
      query: () => ({
        url: "/integrations/jira/oauth/authorize",
        method: "GET",
      }),
    }),

    getJiraSites: builder.query<JiraAccessibleSite[], void>({
      query: () => ({
        url: "/integrations/jira/sites",
        method: "GET",
      }),

      providesTags: ["Jira"],
    }),

    selectJiraSite: builder.mutation<unknown, SelectJiraSiteRequest>({
      query: (body) => ({
        url: "/integrations/jira/site",
        method: "POST",
        body,
      }),

      invalidatesTags: ["Jira"],
    }),

    getJiraProjects: builder.query<JiraProject[], void>({
      query: () => ({
        url: "/integrations/jira/projects",
        method: "GET",
      }),

      providesTags: ["Jira"],
    }),

    selectJiraProject: builder.mutation<unknown, SelectJiraProjectRequest>({
      query: (body) => ({
        url: "/integrations/jira/project",
        method: "POST",
        body,
      }),

      invalidatesTags: ["Jira"],
    }),
  }),
});

export const {
  useGetJiraSetupQuery,
  useBeginJiraOAuthMutation,
  useGetJiraSitesQuery,
  useSelectJiraSiteMutation,
  useGetJiraProjectsQuery,
  useSelectJiraProjectMutation,
} = jiraApi;
