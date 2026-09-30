import type { AdminUserListItem } from "@/features/admin/admin.types";

import { adminBaseApi } from "./admin-base-api";

export const adminUsersApi = adminBaseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminUsers: builder.query<AdminUserListItem[], void>({
      query: () => ({
        url: "/admin/users",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetAdminUsersQuery } = adminUsersApi;
