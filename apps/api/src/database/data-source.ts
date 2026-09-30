import { resolve } from 'node:path';

import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { databaseConnectionOptions } from './connection-options.js';

dotenv.config({
  path: resolve(process.cwd(), '../../.env'),
});

dotenv.config({
  path: resolve(process.cwd(), '.env'),
  override: false,
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const runningFromTypeScript = import.meta.url.endsWith('.ts');

const sourceRoot = runningFromTypeScript ? 'src' : 'dist';

const extension = runningFromTypeScript ? 'ts' : 'js';

const appDataSource = new DataSource({
  type: 'postgres',

  ...databaseConnectionOptions({
    DATABASE_URL: databaseUrl,
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_SSL_MODE: process.env.DATABASE_SSL_MODE as
      'disable' | 'verify-full' | undefined,
    DATABASE_SSL_CA_FILE: process.env.DATABASE_SSL_CA_FILE,
  }),

  synchronize: false,

  migrationsRun: false,

  logging: false,

  entities: [resolve(process.cwd(), `${sourceRoot}/**/*.entity.${extension}`)],

  migrations: [
    resolve(process.cwd(), `${sourceRoot}/database/migrations/*.${extension}`),
  ],

  migrationsTableName: 'typeorm_migrations',
});

export default appDataSource;
