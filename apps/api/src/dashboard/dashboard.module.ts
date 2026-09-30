import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { InterventionsModule } from '../interventions/interventions.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';
import { SprintsModule } from '../sprints/sprints.module.js';

import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [AuthModule, MeetingsModule, SprintsModule, InterventionsModule],

  controllers: [DashboardController],

  providers: [DashboardService],
})
export class DashboardModule {}
