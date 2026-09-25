import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AtlassianConnectionsRepository } from './atlassian-connections.repository.js';
import { AtlassianConnectionsService } from './atlassian-connections.service.js';
import { AtlassianOAuthStateStore } from './atlassian-oauth-state.store.js';
import { AtlassianOAuthService } from './atlassian-oauth.service.js';
import { AtlassianTokenCryptoService } from './atlassian-token-crypto.service.js';

import { AtlassianConnectionEntity } from './entities/atlassian-connection.entity.js';
import { JiraIssueMappingEntity } from './entities/jira-issue-mapping.entity.js';
import { JiraSprintMappingEntity } from './entities/jira-sprint-mapping.entity.js';

import { JiraOAuthController } from './jira-oauth.controller.js';
import { AtlassianApiService } from './atlassian-api.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AtlassianConnectionEntity,
      JiraIssueMappingEntity,
      JiraSprintMappingEntity,
    ]),
  ],

  controllers: [JiraOAuthController],

  providers: [
    AtlassianTokenCryptoService,
    AtlassianConnectionsRepository,
    AtlassianConnectionsService,
    AtlassianOAuthStateStore,
    AtlassianOAuthService,
    AtlassianApiService,
  ],

  exports: [
    TypeOrmModule,
    AtlassianTokenCryptoService,
    AtlassianConnectionsService,
    AtlassianOAuthStateStore,
    AtlassianOAuthService,
    AtlassianApiService,
  ],
})
export class JiraIntegrationModule {}
