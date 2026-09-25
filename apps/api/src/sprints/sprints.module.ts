import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JiraIntegrationModule } from '../integrations/jira/jira-integration.module.js';

import { SprintItemEntity } from './entities/sprint-item.entity.js';
import { SprintEntity } from './entities/sprint.entity.js';
import { SprintsRepository } from './sprints.repository.js';
import { SprintsService } from './sprints.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SprintEntity,
      SprintItemEntity,
    ]),

    JiraIntegrationModule,
  ],

  providers: [
    SprintsRepository,
    SprintsService,
  ],

  exports: [
    SprintsRepository,
    SprintsService,
  ],
})
export class SprintsModule {}
