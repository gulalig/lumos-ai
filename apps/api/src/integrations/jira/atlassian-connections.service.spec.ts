import { describe, expect, it, vi } from 'vitest';

import { AtlassianConnectionsRepository } from './atlassian-connections.repository.js';
import { AtlassianConnectionsService } from './atlassian-connections.service.js';
import { AtlassianTokenCryptoService } from './atlassian-token-crypto.service.js';
import { AtlassianConnectionEntity } from './entities/atlassian-connection.entity.js';

function createFixture() {
  let connection: AtlassianConnectionEntity | null = null;

  const repository = {
    findByWorkspaceId: vi.fn(async () => connection),

    create: vi.fn((values: Partial<AtlassianConnectionEntity>) =>
      Object.assign(new AtlassianConnectionEntity(), values),
    ),

    save: vi.fn(async (value: AtlassianConnectionEntity) => {
      connection = value;

      return value;
    }),
  } as unknown as AtlassianConnectionsRepository;

  const crypto = {
    encrypt: vi.fn((value: string) => `encrypted:${value}`),

    decrypt: vi.fn((value: string) => value.replace('encrypted:', '')),
  } as unknown as AtlassianTokenCryptoService;

  const service = new AtlassianConnectionsService(repository, crypto);

  return {
    service,
    repository,
    crypto,
    getConnection: () => connection,
  };
}

describe('AtlassianConnectionsService', () => {
  it('stores Atlassian tokens encrypted', async () => {
    const fixture = createFixture();

    const result = await fixture.service.saveTokens({
      workspaceId: 'workspace-1',

      accessToken: 'access-token',

      refreshToken: 'refresh-token',

      accessTokenExpiresAt: new Date('2026-09-25T15:00:00.000Z'),

      grantedScopes: ['read:jira-work', 'offline_access'],
    });

    expect(result.accessTokenEncrypted).toBe('encrypted:access-token');

    expect(result.refreshTokenEncrypted).toBe('encrypted:refresh-token');

    expect(fixture.crypto.encrypt).toHaveBeenCalledWith('access-token');

    expect(fixture.crypto.encrypt).toHaveBeenCalledWith('refresh-token');
  });

  it('selects site then project', async () => {
    const fixture = createFixture();

    await fixture.service.saveTokens({
      workspaceId: 'workspace-1',

      accessToken: 'access-token',

      refreshToken: null,

      accessTokenExpiresAt: null,

      grantedScopes: [],
    });

    await fixture.service.selectSite({
      workspaceId: 'workspace-1',

      cloudId: 'cloud-1',

      siteName: 'Lumos Jira',

      siteUrl: 'https://lumos.atlassian.net',
    });

    const result = await fixture.service.selectProject({
      workspaceId: 'workspace-1',

      projectId: '10000',

      projectKey: 'LUM',

      projectName: 'Lumos',
    });

    expect(result.cloudId).toBe('cloud-1');

    expect(result.projectKey).toBe('LUM');

    expect(result.status).toBe('connected');
  });

  it('decrypts stored access token', async () => {
    const fixture = createFixture();

    await fixture.service.saveTokens({
      workspaceId: 'workspace-1',

      accessToken: 'secret-access-token',

      refreshToken: null,

      accessTokenExpiresAt: null,

      grantedScopes: [],
    });

    await expect(fixture.service.getAccessToken('workspace-1')).resolves.toBe(
      'secret-access-token',
    );
  });
});
