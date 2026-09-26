import {
  clearAuth,
  setAccessToken,
  setAuth,
  setIdentity,
} from "@/store/slices/auth.slice";

import { baseApi } from "./base-api";

import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  MeResponse,
  RefreshResponse,
  ResendEmailVerificationRequest,
  ResetPasswordRequest,
  SignupRequest,
  SignupResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from "@/features/auth/auth.types";

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    signup: builder.mutation<SignupResponse, SignupRequest>({
      query: (body) => ({
        url: "/auth/signup",
        method: "POST",
        body,
      }),
    }),

    verifyEmail: builder.mutation<VerifyEmailResponse, VerifyEmailRequest>({
      query: (body) => ({
        url: "/auth/verify-email",
        method: "POST",
        body,
      }),
    }),

    resendEmailVerification: builder.mutation<
      unknown,
      ResendEmailVerificationRequest
    >({
      query: (body) => ({
        url: "/auth/resend-email-verification",

        method: "POST",

        body,
      }),
    }),

    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),

      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          dispatch(
            setAuth({
              accessToken: data.accessToken,

              user: data.user,

              workspace: data.workspace,
            }),
          );
        } catch {
          // RTK Query exposes the request error
          // to the calling component.
        }
      },
    }),

    refresh: builder.mutation<RefreshResponse, void>({
      query: () => ({
        url: "/auth/refresh",
        method: "POST",
      }),

      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          dispatch(setAccessToken(data.accessToken));
        } catch {
          dispatch(clearAuth());
        }
      },
    }),

    me: builder.query<MeResponse, void>({
      query: () => ({
        url: "/auth/me",
        method: "GET",
      }),

      providesTags: ["Auth"],

      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          dispatch(
            setIdentity({
              user: data.user,

              workspace: data.workspace,
            }),
          );
        } catch {
          // The session bootstrap layer decides
          // whether refresh should be attempted.
        }
      },
    }),

    logout: builder.mutation<LogoutResponse, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),

      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(clearAuth());
          dispatch(baseApi.util.resetApiState());
        }
      },
    }),

    forgotPassword: builder.mutation<unknown, ForgotPasswordRequest>({
      query: (body) => ({
        url: "/auth/forgot-password",

        method: "POST",

        body,
      }),
    }),

    resetPassword: builder.mutation<unknown, ResetPasswordRequest>({
      query: (body) => ({
        url: "/auth/reset-password",

        method: "POST",

        body,
      }),
    }),
  }),
});

export const {
  useSignupMutation,
  useVerifyEmailMutation,
  useResendEmailVerificationMutation,
  useLoginMutation,
  useRefreshMutation,
  useMeQuery,
  useLazyMeQuery,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi;
