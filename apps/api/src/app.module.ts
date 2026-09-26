import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';

import { envSchema } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';
import { LiveKitModule } from './livekit/livekit.module.js';
import { MeetingsModule } from './meetings/meetings.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { SprintsModule } from './sprints/sprints.module.js';
import { JiraIntegrationModule } from './integrations/jira/jira-integration.module.js';
import { ExecutionModule } from './execution/execution.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,

      envFilePath: [
        resolve(process.cwd(), '../../.env'),
        resolve(process.cwd(), '.env'),
      ],

      validate: (config) => envSchema.parse(config),
    }),

    DatabaseModule,
    RedisModule,
    HealthModule,
    LiveKitModule,
    MeetingsModule,
    IdentityModule,
    SprintsModule,
    JiraIntegrationModule,
    ExecutionModule,
    AuthModule,
  ],
})
export class AppModule {}
