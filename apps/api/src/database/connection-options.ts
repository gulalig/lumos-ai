import { readFileSync } from 'node:fs';

interface DatabaseEnvironment {
  DATABASE_URL: string;
  NODE_ENV?: string;
  DATABASE_SSL_MODE?: 'disable' | 'verify-full';
  DATABASE_SSL_CA_FILE?: string;
}

// Shared by TypeORM, the pg pool, and the compiled migration CLI.
export function databaseConnectionOptions(env: DatabaseEnvironment) {
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL');
  }
  const urlMode = url.searchParams.get('sslmode');
  const production = env.NODE_ENV === 'production';
  if (
    production &&
    (env.DATABASE_SSL_MODE === 'disable' ||
      ['disable', 'no-verify'].includes(urlMode ?? ''))
  ) {
    throw new Error('Production PostgreSQL requires verified TLS');
  }
  const tls =
    production ||
    env.DATABASE_SSL_MODE === 'verify-full' ||
    (env.DATABASE_SSL_MODE !== 'disable' &&
      urlMode !== null &&
      urlMode !== 'disable');
  const caFile =
    env.DATABASE_SSL_CA_FILE || url.searchParams.get('sslrootcert');
  // pg otherwise replaces our verified SSL object with connection-string options.
  for (const parameter of [
    'sslmode',
    'ssl',
    'sslrootcert',
    'sslcert',
    'sslkey',
    'uselibpqcompat',
    'sslnegotiation',
  ]) {
    url.searchParams.delete(parameter);
  }
  return {
    url: url.toString(),
    ssl: tls
      ? {
          rejectUnauthorized: true,
          ...(caFile ? { ca: readFileSync(caFile, 'utf8') } : {}),
        }
      : false,
  };
}
