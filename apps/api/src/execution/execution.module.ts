import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InterventionsModule } from '../interventions/interventions.module.js';
import { JiraIntegrationModule } from '../integrations/jira/jira-integration.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';
import { RedisModule } from '../redis/redis.module.js';

import { ExecutionObservationLinkEntity } from './entities/execution-observation-link.entity.js';
import { ExecutionRepository } from './execution.repository.js';
import { ExecutionService } from './execution.service.js';
import { SemanticExecutionWorker } from './semantic-execution.worker.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExecutionObservationLinkEntity]),
    MeetingsModule,
    RedisModule,
    InterventionsModule,
    JiraIntegrationModule,
  ],

  providers: [ExecutionRepository, ExecutionService, SemanticExecutionWorker],

  exports: [ExecutionRepository, ExecutionService],
})
export class ExecutionModule {}
