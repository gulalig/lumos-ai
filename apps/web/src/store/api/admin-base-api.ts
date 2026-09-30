import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type { RootState } from "@/store";
import { API_CONFIG } from "@/constants/api";

const ADMIN_API_BASE_URL = API_CONFIG.baseUrl;

export const adminBaseApi = createApi({
  reducerPath: "adminApi",

  baseQuery: fetchBaseQuery({
    baseUrl: ADMIN_API_BASE_URL,

    prepareHeaders: (headers, { getState }) => {
      const state = getState() as RootState;

      const accessToken = state.adminAuth.accessToken;

      if (accessToken) {
        headers.set("authorization", `Bearer ${accessToken}`);
      }

      return headers;
    },
  }),

  endpoints: () => ({}),
});
