import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceUsagePolicyEntity } from './entities/workspace-usage-policy.entity.js';
import { UsageControlService } from './usage-control.service.js';
import { WorkspaceUsagePoliciesRepository } from './workspace-usage-policies.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceUsagePolicyEntity])],

  providers: [WorkspaceUsagePoliciesRepository, UsageControlService],

  exports: [WorkspaceUsagePoliciesRepository, UsageControlService],
})
export class UsageModule {}
