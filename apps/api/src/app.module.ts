import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';

import { envSchema } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';
import { LiveKitModule } from "./livekit/livekit.module.js";

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
  ],
})
export class AppModule {}
