import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AtlassianTokenCryptoService } from './atlassian-token-crypto.service.js';
import { AtlassianConnectionsRepository } from './atlassian-connections.repository.js';
import { AtlassianConnectionEntity } from './entities/atlassian-connection.entity.js';

export interface SaveAtlassianTokensInput {
  workspaceId: string;

  accessToken: string;
  refreshToken: string | null;

  accessTokenExpiresAt: Date | null;

  grantedScopes: string[];
}

export interface SelectAtlassianSiteInput {
  workspaceId: string;

  cloudId: string;
  siteName: string;
  siteUrl: string;
}

export interface SelectJiraProjectInput {
  workspaceId: string;

  projectId: string;
  projectKey: string;
  projectName: string;
}

@Injectable()
export class AtlassianConnectionsService {
  public constructor(
    private readonly connections: AtlassianConnectionsRepository,
    private readonly tokenCrypto: AtlassianTokenCryptoService,
  ) {}

  public async getByWorkspaceId(
    workspaceId: string,
  ): Promise<AtlassianConnectionEntity | null> {
    return this.connections.findByWorkspaceId(workspaceId);
  }

  public async requireByWorkspaceId(
    workspaceId: string,
  ): Promise<AtlassianConnectionEntity> {
    const connection = await this.connections.findByWorkspaceId(workspaceId);

    if (!connection) {
      throw new NotFoundException(
        `Atlassian connection for workspace ${workspaceId} was not found`,
      );
    }

    return connection;
  }

  public async saveTokens(
    input: SaveAtlassianTokensInput,
  ): Promise<AtlassianConnectionEntity> {
    let connection = await this.connections.findByWorkspaceId(
      input.workspaceId,
    );

    if (!connection) {
      connection = this.connections.create({
        id: randomUUID(),

        workspaceId: input.workspaceId,

        cloudId: null,
        siteName: null,
        siteUrl: null,

        projectId: null,
        projectKey: null,
        projectName: null,

        accessTokenEncrypted: null,

        refreshTokenEncrypted: null,

        accessTokenExpiresAt: null,

        grantedScopes: [],

        status: 'pending',

        lastError: null,
      });
    }

    connection.accessTokenEncrypted = this.tokenCrypto.encrypt(
      input.accessToken,
    );

    connection.refreshTokenEncrypted = input.refreshToken
      ? this.tokenCrypto.encrypt(input.refreshToken)
      : null;

    connection.accessTokenExpiresAt = input.accessTokenExpiresAt;

    connection.grantedScopes = [...input.grantedScopes];

    connection.status = 'pending';

    connection.lastError = null;

    return this.connections.save(connection);
  }

  public async selectSite(
    input: SelectAtlassianSiteInput,
  ): Promise<AtlassianConnectionEntity> {
    const connection = await this.requireByWorkspaceId(input.workspaceId);

    connection.cloudId = input.cloudId;

    connection.siteName = input.siteName;

    connection.siteUrl = input.siteUrl;

    connection.projectId = null;

    connection.projectKey = null;

    connection.projectName = null;

    connection.status = 'pending';

    connection.lastError = null;

    return this.connections.save(connection);
  }

  public async selectProject(
    input: SelectJiraProjectInput,
  ): Promise<AtlassianConnectionEntity> {
    const connection = await this.requireByWorkspaceId(input.workspaceId);

    if (!connection.cloudId) {
      throw new Error(
        'Atlassian site must be selected before Jira project selection',
      );
    }

    connection.projectId = input.projectId;

    connection.projectKey = input.projectKey;

    connection.projectName = input.projectName;

    connection.status = 'connected';

    connection.lastError = null;

    return this.connections.save(connection);
  }

  public async markError(
    workspaceId: string,
    message: string,
  ): Promise<AtlassianConnectionEntity> {
    const connection = await this.requireByWorkspaceId(workspaceId);

    connection.status = 'error';

    connection.lastError = message;

    return this.connections.save(connection);
  }

  public async getAccessToken(workspaceId: string): Promise<string> {
    const connection = await this.requireByWorkspaceId(workspaceId);

    if (!connection.accessTokenEncrypted) {
      throw new Error('Atlassian access token is not available');
    }

    return this.tokenCrypto.decrypt(connection.accessTokenEncrypted);
  }

  public async getRefreshToken(workspaceId: string): Promise<string | null> {
    const connection = await this.requireByWorkspaceId(workspaceId);

    if (!connection.refreshTokenEncrypted) {
      return null;
    }

    return this.tokenCrypto.decrypt(connection.refreshTokenEncrypted);
  }

  public async replaceTokens(
    input: SaveAtlassianTokensInput,
  ): Promise<AtlassianConnectionEntity> {
    const connection = await this.requireByWorkspaceId(input.workspaceId);

    connection.accessTokenEncrypted = this.tokenCrypto.encrypt(
      input.accessToken,
    );

    if (input.refreshToken) {
      connection.refreshTokenEncrypted = this.tokenCrypto.encrypt(
        input.refreshToken,
      );
    }

    connection.accessTokenExpiresAt = input.accessTokenExpiresAt;

    connection.grantedScopes =
      input.grantedScopes.length > 0
        ? [...input.grantedScopes]
        : connection.grantedScopes;

    connection.lastError = null;

    return this.connections.save(connection);
  }
}
