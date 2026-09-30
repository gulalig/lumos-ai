import type { AdminSystemStatus } from "@/features/admin/admin.types";

import { adminBaseApi } from "./admin-base-api";

export const adminSystemApi = adminBaseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminSystem: builder.query<AdminSystemStatus, void>({
      query: () => ({
        url: "/admin/system",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetAdminSystemQuery } = adminSystemApi;
