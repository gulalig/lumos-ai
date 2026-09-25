import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { Env } from '../../config/env.js';

import { AtlassianOAuthService } from './atlassian-oauth.service.js';

function createService(): AtlassianOAuthService {
  const values: Partial<Record<keyof Env, string>> = {
    ATLASSIAN_CLIENT_ID: 'client-id',

    ATLASSIAN_CLIENT_SECRET: 'client-secret',

    ATLASSIAN_REDIRECT_URI:
      'http://localhost:3001/api/v1/integrations/jira/oauth/callback',
  };

  const config = {
    get: (name: keyof Env) => {
      const value = values[name];

      if (!value) {
        throw new Error(`unexpected config key ${name}`);
      }

      return value;
    },
  } as unknown as ConfigService<Env, true>;

  return new AtlassianOAuthService(config);
}

describe('AtlassianOAuthService', () => {
  it('creates authorization URL using opaque state', () => {
    const service = createService();

    const url = new URL(service.createAuthorizationUrl('opaque-state-value'));

    expect(url.origin).toBe('https://auth.atlassian.com');

    expect(url.pathname).toBe('/authorize');

    expect(url.searchParams.get('state')).toBe('opaque-state-value');

    expect(url.searchParams.get('client_id')).toBe('client-id');

    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3001/api/v1/integrations/jira/oauth/callback',
    );

    expect(url.searchParams.get('scope')).toContain('offline_access');

    expect(url.searchParams.get('response_type')).toBe('code');
  });
});
