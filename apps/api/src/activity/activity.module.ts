import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { InterventionsModule } from '../interventions/interventions.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';

import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

@Module({
  imports: [AuthModule, MeetingsModule, InterventionsModule],

  controllers: [ActivityController],

  providers: [ActivityService],
})
export class ActivityModule {}
