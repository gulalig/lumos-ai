import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { JiraIntegrationModule } from '../integrations/jira/jira-integration.module.js';

import { SprintItemEntity } from './entities/sprint-item.entity.js';
import { SprintEntity } from './entities/sprint.entity.js';
import { SprintsController } from './sprints.controller.js';
import { SprintsRepository } from './sprints.repository.js';
import { SprintsService } from './sprints.service.js';

@Module({
  imports: [
    AuthModule,

    TypeOrmModule.forFeature([SprintEntity, SprintItemEntity]),

    JiraIntegrationModule,
  ],

  controllers: [SprintsController],

  providers: [SprintsRepository, SprintsService],

  exports: [SprintsRepository, SprintsService],
})
export class SprintsModule {}
