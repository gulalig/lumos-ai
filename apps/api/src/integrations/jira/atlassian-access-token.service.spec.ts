import { describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { AtlassianAccessTokenService } from './atlassian-access-token.service.js';
import { AtlassianOAuthService } from './atlassian-oauth.service.js';
import { AtlassianTokenCryptoService } from './atlassian-token-crypto.service.js';
import { AtlassianConnectionEntity } from './entities/atlassian-connection.entity.js';

function createFixture(input?: {
  expiresAt?: Date | null;
  accessToken?: string;
  refreshToken?: string | null;
}) {
  const connection = Object.assign(new AtlassianConnectionEntity(), {
    id: 'connection-1',
    workspaceId: 'workspace-1',

    accessTokenEncrypted: `encrypted:${input?.accessToken ?? 'access-old'}`,

    refreshTokenEncrypted:
      input?.refreshToken === null
        ? null
        : `encrypted:${input?.refreshToken ?? 'refresh-old'}`,

    accessTokenExpiresAt:
      input?.expiresAt ?? new Date(Date.now() + 10 * 60_000),

    grantedScopes: ['read:jira-work'],
    status: 'connected' as const,
    lastError: null,
  });

  const repository = {
    findOne: vi.fn(async () => connection),

    save: vi.fn(async (value: AtlassianConnectionEntity) => value),
  };

  type TestManager = {
    getRepository: ReturnType<typeof vi.fn>;
  };

  const manager: TestManager = {
    getRepository: vi.fn(() => repository),
  };

  const dataSource = {
    getRepository: vi.fn(() => repository),

    transaction: vi.fn(
      async (callback: (txManager: TestManager) => Promise<unknown>) =>
        callback(manager),
    ),
  } as unknown as DataSource;

  const oauth = {
    refreshAccessToken: vi.fn(),
  } as unknown as AtlassianOAuthService;

  const crypto = {
    encrypt: vi.fn((value: string) => `encrypted:${value}`),

    decrypt: vi.fn((value: string) => value.replace('encrypted:', '')),
  } as unknown as AtlassianTokenCryptoService;

  const service = new AtlassianAccessTokenService(dataSource, oauth, crypto);

  return {
    connection,
    repository,
    dataSource,
    oauth,
    crypto,
    service,
  };
}

describe('AtlassianAccessTokenService', () => {
  it('returns the existing access token when it is still usable', async () => {
    const fixture = createFixture({
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });

    await expect(
      fixture.service.getValidAccessToken('workspace-1'),
    ).resolves.toBe('access-old');

    expect(fixture.oauth.refreshAccessToken).not.toHaveBeenCalled();

    expect(fixture.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('refreshes an expired token and persists rotated tokens', async () => {
    const fixture = createFixture({
      expiresAt: new Date(Date.now() - 60_000),
    });

    vi.mocked(fixture.oauth.refreshAccessToken).mockResolvedValue({
      accessToken: 'access-new',

      refreshToken: 'refresh-new',

      expiresIn: 3600,

      scopes: ['read:jira-work', 'write:jira-work'],
    });

    await expect(
      fixture.service.getValidAccessToken('workspace-1'),
    ).resolves.toBe('access-new');

    expect(fixture.oauth.refreshAccessToken).toHaveBeenCalledWith(
      'refresh-old',
    );

    expect(fixture.connection.accessTokenEncrypted).toBe(
      'encrypted:access-new',
    );

    expect(fixture.connection.refreshTokenEncrypted).toBe(
      'encrypted:refresh-new',
    );

    expect(fixture.connection.grantedScopes).toEqual([
      'read:jira-work',
      'write:jira-work',
    ]);

    expect(fixture.repository.save).toHaveBeenCalledTimes(1);

    expect(fixture.connection.accessTokenExpiresAt).not.toBeNull();

    expect(fixture.connection.accessTokenExpiresAt!.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('uses a token already refreshed by another worker after a 401', async () => {
    const fixture = createFixture({
      accessToken: 'access-new',
    });

    await expect(
      fixture.service.refreshAfterUnauthorized('workspace-1', 'access-old'),
    ).resolves.toBe('access-new');

    expect(fixture.oauth.refreshAccessToken).not.toHaveBeenCalled();

    expect(fixture.repository.save).not.toHaveBeenCalled();
  });
});
