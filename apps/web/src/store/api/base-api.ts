import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { API_CONFIG } from "@/constants/api";

import type { RootState } from "../index";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_CONFIG.baseUrl,

  credentials: "include",

  prepareHeaders: (headers, { getState }) => {
    const accessToken = (getState() as RootState).auth.accessToken;

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return headers;
  },
});

export const baseApi = createApi({
  reducerPath: "api",

  baseQuery: rawBaseQuery,

  tagTypes: ["Auth", "Meetings", "Sprint", "Jira", "Dashboard"],

  endpoints: () => ({}),
});
