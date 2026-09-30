import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import type { Env } from '../config/env.js';
import { databaseConnectionOptions } from './connection-options.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  private readonly pool: Pool;

  constructor(private readonly config: ConfigService<Env, true>) {
    const connection = databaseConnectionOptions({
      DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
      NODE_ENV: config.get('NODE_ENV', { infer: true }),
      DATABASE_SSL_MODE: config.get('DATABASE_SSL_MODE', { infer: true }),
      DATABASE_SSL_CA_FILE: config.get('DATABASE_SSL_CA_FILE', { infer: true }),
    });
    this.pool = new Pool({
      connectionString: connection.url,
      ssl: connection.ssl,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');

    this.logger.log('PostgreSQL connection established');
  }

  async query<T extends object>(text: string, values?: unknown[]) {
    return this.pool.query<T>(text, values);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');

      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();

    this.logger.log('PostgreSQL connection closed');
  }
}
