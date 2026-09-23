import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JiraIssueMappingEntity } from './entities/jira-issue-mapping.entity.js';
import { JiraSprintMappingEntity } from './entities/jira-sprint-mapping.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JiraIssueMappingEntity,
      JiraSprintMappingEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class JiraIntegrationModule {}
