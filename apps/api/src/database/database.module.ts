import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { Env } from '../config/env.js';

import { ExecutionObservationLinkEntity } from '../execution/entities/execution-observation-link.entity.js';

import { UserEntity } from '../identity/entities/user.entity.js';
import { WorkspaceMemberEntity } from '../identity/entities/workspace-member.entity.js';
import { WorkspaceEntity } from '../identity/entities/workspace.entity.js';

import { JiraIssueMappingEntity } from '../integrations/jira/entities/jira-issue-mapping.entity.js';
import { JiraSprintMappingEntity } from '../integrations/jira/entities/jira-sprint-mapping.entity.js';

import { MeetingParticipantEntity } from '../meetings/meeting-participant.entity.js';
import { MeetingEntity } from '../meetings/meeting.entity.js';

import { SprintItemEntity } from '../sprints/entities/sprint-item.entity.js';
import { SprintEntity } from '../sprints/entities/sprint.entity.js';

import { DatabaseService } from './database.service.js';
import { AtlassianConnectionEntity } from '../integrations/jira/entities/atlassian-connection.entity.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (config: ConfigService<Env, true>) => ({
        type: 'postgres' as const,

        url: config.get('DATABASE_URL', {
          infer: true,
        }),

        entities: [
          UserEntity,
          WorkspaceEntity,
          WorkspaceMemberEntity,

          MeetingEntity,
          MeetingParticipantEntity,

          SprintEntity,
          SprintItemEntity,

          AtlassianConnectionEntity,
          JiraIssueMappingEntity,
          JiraSprintMappingEntity,

          ExecutionObservationLinkEntity,
        ],

        synchronize: false,
        migrationsRun: false,
        logging: false,
      }),
    }),
  ],

  providers: [DatabaseService],

  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}
