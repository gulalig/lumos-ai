import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AtlassianOAuthService } from './atlassian-oauth.service.js';
import { AtlassianTokenCryptoService } from './atlassian-token-crypto.service.js';
import { AtlassianConnectionEntity } from './entities/atlassian-connection.entity.js';

const REFRESH_SAFETY_WINDOW_MS = 60_000;

@Injectable()
export class AtlassianAccessTokenService {
  public constructor(
    private readonly dataSource: DataSource,
    private readonly oauth: AtlassianOAuthService,
    private readonly tokenCrypto: AtlassianTokenCryptoService,
  ) {}

  public async getValidAccessToken(workspaceId: string): Promise<string> {
    const repository = this.dataSource.getRepository(AtlassianConnectionEntity);

    const connection = await repository.findOne({
      where: {
        workspaceId,
      },
    });

    if (!connection) {
      throw new NotFoundException(
        `Atlassian connection for workspace ${workspaceId} was not found`,
      );
    }

    if (!connection.accessTokenEncrypted) {
      throw new Error('Atlassian access token is not available');
    }

    const accessToken = this.tokenCrypto.decrypt(
      connection.accessTokenEncrypted,
    );

    if (this.isAccessTokenUsable(connection.accessTokenExpiresAt)) {
      return accessToken;
    }

    return this.refreshLocked(workspaceId, null);
  }

  public async refreshAfterUnauthorized(
    workspaceId: string,
    rejectedAccessToken: string,
  ): Promise<string> {
    return this.refreshLocked(workspaceId, rejectedAccessToken);
  }

  private async refreshLocked(
    workspaceId: string,
    rejectedAccessToken: string | null,
  ): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AtlassianConnectionEntity);

      const connection = await repository.findOne({
        where: {
          workspaceId,
        },

        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!connection) {
        throw new NotFoundException(
          `Atlassian connection for workspace ${workspaceId} was not found`,
        );
      }

      if (!connection.accessTokenEncrypted) {
        throw new Error('Atlassian access token is not available');
      }

      const currentAccessToken = this.tokenCrypto.decrypt(
        connection.accessTokenEncrypted,
      );

      /*
       * Another process may already have refreshed
       * while this caller was waiting for the row lock.
       *
       * If the stored token is no longer the token
       * that received HTTP 401, use the newer token.
       */
      if (
        rejectedAccessToken !== null &&
        currentAccessToken !== rejectedAccessToken
      ) {
        return currentAccessToken;
      }

      /*
       * For normal proactive refresh, re-check expiry
       * after acquiring the lock.
       *
       * Another worker may already have refreshed it.
       */
      if (
        rejectedAccessToken === null &&
        this.isAccessTokenUsable(connection.accessTokenExpiresAt)
      ) {
        return currentAccessToken;
      }

      if (!connection.refreshTokenEncrypted) {
        throw new Error('Atlassian refresh token is not available');
      }

      const refreshToken = this.tokenCrypto.decrypt(
        connection.refreshTokenEncrypted,
      );

      const refreshed = await this.oauth.refreshAccessToken(refreshToken);

      connection.accessTokenEncrypted = this.tokenCrypto.encrypt(
        refreshed.accessToken,
      );

      if (refreshed.refreshToken) {
        connection.refreshTokenEncrypted = this.tokenCrypto.encrypt(
          refreshed.refreshToken,
        );
      }

      connection.accessTokenExpiresAt =
        refreshed.expiresIn === null
          ? null
          : new Date(Date.now() + refreshed.expiresIn * 1000);

      if (refreshed.scopes.length > 0) {
        connection.grantedScopes = [...refreshed.scopes];
      }

      connection.lastError = null;

      await repository.save(connection);

      return refreshed.accessToken;
    });
  }

  private isAccessTokenUsable(expiresAt: Date | null): boolean {
    if (!expiresAt) {
      return false;
    }

    return expiresAt.getTime() - Date.now() > REFRESH_SAFETY_WINDOW_MS;
  }
}
