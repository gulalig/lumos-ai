import { resolve } from 'node:path';

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({
  path: resolve(process.cwd(), '../../.env'),
  quiet: true,
});

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

try {
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'users',
        'workspaces',
        'workspace_members',
        'meetings',
        'meeting_participants'
      )
    ORDER BY table_name;
  `);

  const meetings = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM meetings;
  `);

  const workspaceColumn = await client.query(`
    SELECT
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetings'
      AND column_name = 'workspace_id';
  `);

  const migrations = await client.query(`
    SELECT
      id,
      timestamp,
      name
    FROM typeorm_migrations
    ORDER BY id;
  `);

  console.log('\n===== TABLES =====');
  console.table(tables.rows);

  console.log('\n===== MEETING COUNT =====');
  console.table(meetings.rows);

  console.log('\n===== WORKSPACE COLUMN =====');
  console.table(workspaceColumn.rows);

  console.log('\n===== MIGRATIONS =====');
  console.table(migrations.rows);
} finally {
  await client.end();
}
