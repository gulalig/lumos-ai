import type { DashboardExecutionStatus } from "@/features/dashboard/dashboard.types";

import { baseApi } from "./base-api";

export interface UpdateSprintItemRequest {
  itemId: string;

  body: {
    title?: string;
    description?: string | null;
    status?: DashboardExecutionStatus;
    ownerWorkspaceMemberId?: string | null;
    dueAt?: string | null;
    blockerText?: string | null;
    acceptanceCriteria?: string[];
  };
}

export const sprintsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    updateSprintItem: builder.mutation<unknown, UpdateSprintItemRequest>({
      query: ({ itemId, body }) => ({
        url: `/sprint-items/${itemId}`,
        method: "PATCH",
        body,
      }),
    }),
  }),
});

export const { useUpdateSprintItemMutation } = sprintsApi;
