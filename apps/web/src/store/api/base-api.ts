import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

import { API_CONFIG } from "@/constants/api";
import { clearAuth, setAccessToken } from "@/store/slices/auth.slice";

interface AuthStateShape {
  auth: {
    accessToken: string | null;
  };
}

interface RefreshResponse {
  accessToken: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_CONFIG.baseUrl,
  credentials: "include",

  prepareHeaders: (headers, { getState }) => {
    const state = getState() as AuthStateShape;

    const accessToken = state.auth.accessToken;

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return headers;
  },
});

let refreshPromise: Promise<string | null> | null = null;

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status !== 401) {
    return result;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshResult = await rawBaseQuery(
        {
          url: "/auth/refresh",
          method: "POST",
        },
        api,
        extraOptions,
      );

      if (refreshResult.error) {
        api.dispatch(clearAuth());

        return null;
      }

      const refreshData = refreshResult.data as RefreshResponse;

      api.dispatch(setAccessToken(refreshData.accessToken));

      return refreshData.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  const accessToken = await refreshPromise;

  if (!accessToken) {
    return result;
  }

  result = await rawBaseQuery(args, api, extraOptions);

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",

  baseQuery: baseQueryWithReauth,

  tagTypes: ["Auth", "Meetings", "Sprint", "Jira", "Dashboard"],

  endpoints: () => ({}),
});
