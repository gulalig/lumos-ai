import type { DashboardOverviewResponse } from "@/features/dashboard/dashboard.types";

import { baseApi } from "./base-api";

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardOverview: builder.query<DashboardOverviewResponse, void>({
      query: () => ({
        url: "/dashboard/overview",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetDashboardOverviewQuery } = dashboardApi;
