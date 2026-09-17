import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';

import { envSchema } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { RedisModule } from './redis/redis.module.js';

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
  ],
})
export class AppModule {}
