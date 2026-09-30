import type { AdminIntegrationsResponse } from "@/features/admin/admin.types";

import { adminBaseApi } from "./admin-base-api";

export const adminIntegrationsApi = adminBaseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminIntegrations: builder.query<AdminIntegrationsResponse, void>({
      query: () => ({
        url: "/admin/integrations",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetAdminIntegrationsQuery } = adminIntegrationsApi;
