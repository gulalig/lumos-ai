import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';

export interface AtlassianOAuthTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scopes: string[];
}

interface AtlassianTokenEndpointResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
}

const authorizeUrl = 'https://auth.atlassian.com/authorize';

const tokenUrl = 'https://auth.atlassian.com/oauth/token';

const oauthScopes = [
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'offline_access',
];

@Injectable()
export class AtlassianOAuthService {
  public constructor(private readonly config: ConfigService<Env, true>) {}

  public createAuthorizationUrl(state: string): string {
    if (state.length === 0) {
      throw new Error('Atlassian OAuth state is required');
    }

    const url = new URL(authorizeUrl);

    url.searchParams.set('audience', 'api.atlassian.com');

    url.searchParams.set(
      'client_id',
      this.config.get('ATLASSIAN_CLIENT_ID', {
        infer: true,
      }),
    );

    url.searchParams.set('scope', oauthScopes.join(' '));

    url.searchParams.set(
      'redirect_uri',
      this.config.get('ATLASSIAN_REDIRECT_URI', {
        infer: true,
      }),
    );

    url.searchParams.set('state', state);

    url.searchParams.set('response_type', 'code');

    url.searchParams.set('prompt', 'consent');

    return url.toString();
  }

  public async exchangeCode(
    code: string,
  ): Promise<AtlassianOAuthTokenResponse> {
    if (code.length === 0) {
      throw new Error('Atlassian authorization code is required');
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',

        Accept: 'application/json',
      },

      body: JSON.stringify({
        grant_type: 'authorization_code',

        client_id: this.config.get('ATLASSIAN_CLIENT_ID', {
          infer: true,
        }),

        client_secret: this.config.get('ATLASSIAN_CLIENT_SECRET', {
          infer: true,
        }),

        code,

        redirect_uri: this.config.get('ATLASSIAN_REDIRECT_URI', {
          infer: true,
        }),
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `Atlassian token exchange failed with HTTP ${response.status}`,
      );
    }

    const body = (await response.json()) as AtlassianTokenEndpointResponse;

    if (
      typeof body.access_token !== 'string' ||
      body.access_token.length === 0
    ) {
      throw new BadGatewayException(
        'Atlassian token response did not include a valid access token',
      );
    }

    const scopes =
      typeof body.scope === 'string'
        ? body.scope
            .split(' ')
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

    return {
      accessToken: body.access_token,

      refreshToken:
        typeof body.refresh_token === 'string' ? body.refresh_token : null,

      expiresIn: typeof body.expires_in === 'number' ? body.expires_in : null,

      scopes,
    };
  }

  public async refreshAccessToken(
    refreshToken: string,
  ): Promise<AtlassianOAuthTokenResponse> {
    if (refreshToken.length === 0) {
      throw new Error('Atlassian refresh token is required');
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',

        Accept: 'application/json',
      },

      body: JSON.stringify({
        grant_type: 'refresh_token',

        client_id: this.config.get('ATLASSIAN_CLIENT_ID', {
          infer: true,
        }),

        client_secret: this.config.get('ATLASSIAN_CLIENT_SECRET', {
          infer: true,
        }),

        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `Atlassian token refresh failed with HTTP ${response.status}`,
      );
    }

    const body = (await response.json()) as AtlassianTokenEndpointResponse;

    if (
      typeof body.access_token !== 'string' ||
      body.access_token.length === 0
    ) {
      throw new BadGatewayException(
        'Atlassian refresh response did not include a valid access token',
      );
    }

    const scopes =
      typeof body.scope === 'string'
        ? body.scope
            .split(' ')
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

    return {
      accessToken: body.access_token,

      refreshToken:
        typeof body.refresh_token === 'string' ? body.refresh_token : null,

      expiresIn: typeof body.expires_in === 'number' ? body.expires_in : null,

      scopes,
    };
  }
}
