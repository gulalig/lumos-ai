import type { ActivityFeedResponse } from "@/features/activity/activity.types";

import { baseApi } from "./base-api";

export const activityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getActivity: builder.query<ActivityFeedResponse, void>({
      query: () => ({
        url: "/activity",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetActivityQuery } = activityApi;
