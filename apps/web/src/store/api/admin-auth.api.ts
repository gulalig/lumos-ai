import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AdminMeResponse,
} from "@/features/admin-auth/admin-auth.types";
import {
  clearAdminAuth,
  setAdminAuth,
  setAdminIdentity,
} from "@/store/slices/admin-auth.slice";

import { adminBaseApi } from "./admin-base-api";

export const ADMIN_ACCESS_TOKEN_KEY = "lumos-admin-access-token";

export const adminAuthApi = adminBaseApi.injectEndpoints({
  endpoints: (builder) => ({
    adminLogin: builder.mutation<AdminLoginResponse, AdminLoginRequest>({
      query: (body) => ({
        url: "/admin/auth/login",
        method: "POST",
        body,
      }),

      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              ADMIN_ACCESS_TOKEN_KEY,
              data.accessToken,
            );
          }

          dispatch(
            setAdminAuth({
              accessToken: data.accessToken,

              admin: data.admin,
            }),
          );
        } catch {
          // Request error is surfaced by RTK Query.
        }
      },
    }),

    getAdminMe: builder.query<AdminMeResponse, void>({
      query: () => ({
        url: "/admin/auth/me",
        method: "GET",
      }),

      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          dispatch(setAdminIdentity(data.admin));
        } catch {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
          }

          dispatch(clearAdminAuth());
        }
      },
    }),
  }),
});

export const { useAdminLoginMutation, useGetAdminMeQuery } = adminAuthApi;
