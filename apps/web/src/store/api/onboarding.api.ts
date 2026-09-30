import type {
  CompleteWorkflowRequest,
  CompleteWorkflowResponse,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
} from "@/features/onboarding/onboarding.types";
import { setAccessToken, setWorkspace } from "@/store/slices/auth.slice";

import { baseApi } from "./base-api";

export const onboardingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createWorkspace: builder.mutation<
      CreateWorkspaceResponse,
      CreateWorkspaceRequest
    >({
      query: (body) => ({
        url: "/auth/onboarding/workspace",
        method: "POST",
        body,
      }),

      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          dispatch(setAccessToken(data.accessToken));

          dispatch(
            setWorkspace({
              workspaceId: data.workspace.id,

              workspaceMemberId: data.workspace.workspaceMemberId,

              name: data.workspace.name,

              role: data.workspace.role,
            }),
          );

          dispatch(baseApi.util.invalidateTags(["Auth"]));
        } catch {
          // Mutation error is rendered by the form.
        }
      },
    }),

    completeWorkflow: builder.mutation<
      CompleteWorkflowResponse,
      CompleteWorkflowRequest
    >({
      query: (body) => ({
        url: "/auth/onboarding/workflow",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const { useCreateWorkspaceMutation, useCompleteWorkflowMutation } =
  onboardingApi;
