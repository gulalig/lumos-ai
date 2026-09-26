import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { InterventionsModule } from '../interventions/interventions.module.js';
import { JiraIntegrationModule } from '../integrations/jira/jira-integration.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { SprintsModule } from '../sprints/sprints.module.js';

import { ExecutionObservationLinkEntity } from './entities/execution-observation-link.entity.js';
import { ExecutionHistoryController } from './execution-history.controller.js';
import { ExecutionHistoryService } from './execution-history.service.js';
import { ExecutionRepository } from './execution.repository.js';
import { ExecutionService } from './execution.service.js';
import { SemanticExecutionWorker } from './semantic-execution.worker.js';

@Module({
  imports: [
    AuthModule,

    TypeOrmModule.forFeature([ExecutionObservationLinkEntity]),

    MeetingsModule,
    RedisModule,
    InterventionsModule,
    JiraIntegrationModule,
    SprintsModule,
  ],

  controllers: [ExecutionHistoryController],

  providers: [
    ExecutionRepository,
    ExecutionService,
    ExecutionHistoryService,
    SemanticExecutionWorker,
  ],

  exports: [ExecutionRepository, ExecutionService, ExecutionHistoryService],
})
export class ExecutionModule {}
