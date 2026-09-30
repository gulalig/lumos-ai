export interface PlatformAdminAccessTokenPayload {
  sub: string;

  kind: 'platform_admin';
}

export interface PlatformAdminPrincipal {
  adminId: string;

  email: string;

  displayName: string;

  kind: 'platform_admin';
}
