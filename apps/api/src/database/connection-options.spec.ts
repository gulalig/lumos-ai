import { describe, expect, it } from 'vitest';
import { databaseConnectionOptions } from './connection-options.js';

const url = 'postgresql://fixture:fixture@db.example.com/db';
describe('PostgreSQL TLS configuration', () => {
  it('keeps local development plaintext', () => {
    expect(databaseConnectionOptions({ DATABASE_URL: url }).ssl).toBe(false);
  });
  it('requires certificate verification in production', () => {
    expect(
      databaseConnectionOptions({ DATABASE_URL: url, NODE_ENV: 'production' })
        .ssl,
    ).toEqual({ rejectUnauthorized: true });
  });
  it('does not let connection-string flags replace verified TLS', () => {
    const result = databaseConnectionOptions({
      DATABASE_URL:
        url + '?sslmode=require&uselibpqcompat=true&application_name=lumos',
      NODE_ENV: 'production',
    });
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
    expect(result.url).not.toContain('sslmode');
    expect(result.url).toContain('application_name=lumos');
  });
  it('allows explicit TLS in development', () => {
    expect(
      databaseConnectionOptions({
        DATABASE_URL: url,
        DATABASE_SSL_MODE: 'verify-full',
      }).ssl,
    ).toEqual({ rejectUnauthorized: true });
  });
  it.each(['disable', 'no-verify'])(
    'rejects production URL TLS downgrade %s',
    (mode) => {
      expect(() =>
        databaseConnectionOptions({
          DATABASE_URL: url + '?sslmode=' + mode,
          NODE_ENV: 'production',
        }),
      ).toThrow();
    },
  );
  it('rejects explicit production TLS disable', () => {
    expect(() =>
      databaseConnectionOptions({
        DATABASE_URL: url,
        NODE_ENV: 'production',
        DATABASE_SSL_MODE: 'disable',
      }),
    ).toThrow();
  });
  it('does not disclose credentials in invalid URL errors', () => {
    expect(() =>
      databaseConnectionOptions({ DATABASE_URL: 'fixture-secret' }),
    ).toThrow('DATABASE_URL must be a PostgreSQL URL');
  });
});
