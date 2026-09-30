import type { AuthUser, AuthWorkspace } from "@/types/auth";

export interface SignupRequest {
  email: string;

  password: string;

  acceptedTerms: boolean;

  newsletterOptIn: boolean;
}

export interface SignupResponse {
  userId: string;

  email: string;

  verificationRequired: boolean;

  challengeId: string;

  expiresAt: string;
}

export interface VerifyEmailRequest {
  email: string;

  code: string;
}

export interface VerifyEmailResponse {
  verified: boolean;
}

export interface ResendEmailVerificationRequest {
  email: string;
}

export interface LoginRequest {
  email: string;

  password: string;
}

export interface LoginResponse {
  accessToken: string;

  tokenType: "Bearer";

  expiresInSeconds: number;

  user: AuthUser;

  workspace: AuthWorkspace | null;
}

export interface RefreshResponse {
  accessToken: string;

  tokenType: "Bearer";

  expiresInSeconds: number;
}

export interface MeResponse {
  user: AuthUser;

  workspace: AuthWorkspace | null;
}

export interface LogoutResponse {
  loggedOut: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;

  code: string;

  newPassword: string;
}
