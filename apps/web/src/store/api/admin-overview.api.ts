import type { AdminOverview } from "@/features/admin/admin.types";

import { adminBaseApi } from "./admin-base-api";

export const adminOverviewApi = adminBaseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminOverview: builder.query<AdminOverview, void>({
      query: () => ({
        url: "/admin/overview",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetAdminOverviewQuery } = adminOverviewApi;
