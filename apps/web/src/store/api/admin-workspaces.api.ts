import type {
  AdminWorkspaceListItem,
  AdminWorkspaceUsage,
  UpdateAdminWorkspaceUsageRequest,
} from "@/features/admin/admin.types";

import { adminBaseApi } from "./admin-base-api";

export const adminWorkspacesApi = adminBaseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminWorkspaces: builder.query<AdminWorkspaceListItem[], void>({
      query: () => ({
        url: "/admin/workspaces",
        method: "GET",
      }),
    }),

    getAdminWorkspaceUsage: builder.query<AdminWorkspaceUsage, string>({
      query: (workspaceId) => ({
        url: `/admin/workspaces/${workspaceId}/usage`,
        method: "GET",
      }),
    }),

    updateAdminWorkspaceUsage: builder.mutation<
      AdminWorkspaceUsage,
      {
        workspaceId: string;
        body: UpdateAdminWorkspaceUsageRequest;
      }
    >({
      query: ({ workspaceId, body }) => ({
        url: `/admin/workspaces/${workspaceId}/usage`,
        method: "PATCH",
        body,
      }),
    }),
  }),
});

export const {
  useGetAdminWorkspacesQuery,

  useGetAdminWorkspaceUsageQuery,

  useUpdateAdminWorkspaceUsageMutation,
} = adminWorkspacesApi;
