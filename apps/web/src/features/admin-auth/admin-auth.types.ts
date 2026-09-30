export interface PlatformAdmin {
  id: string;
  email: string;
  displayName: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  accessToken: string;
  expiresInSeconds: number;

  admin: PlatformAdmin;
}

export interface AdminMeResponse {
  admin: PlatformAdmin;
}
