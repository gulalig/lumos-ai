import { ConfigService } from '@nestjs/config';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { describe, expect, it, vi } from 'vitest';
import { RefreshCookieService } from '../auth/refresh-cookie.service.js';
import { jiraBrowserRedirect, trustedProxyRanges } from './production.js';
import { envSchema } from './env.js';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://fixture:fixture@db.example.com/db',
  REDIS_URL: 'rediss://fixture:fixture@redis.example.com:6379',
  WEB_ORIGIN: 'https://app.example.com',
  API_PUBLIC_URL: 'https://api.example.com',
  LIVEKIT_URL: 'wss://project.livekit.cloud',
  LIVEKIT_API_KEY: 'fixture',
  LIVEKIT_API_SECRET: 'fixture',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  AUTH_OTP_PEPPER: 'y'.repeat(32),
  ATLASSIAN_TOKEN_ENCRYPTION_KEY: 'z'.repeat(32),
  ATLASSIAN_CLIENT_ID: 'fixture',
  ATLASSIAN_CLIENT_SECRET: 'fixture',
  ATLASSIAN_REDIRECT_URI:
    'https://api.example.com/api/v1/integrations/jira/oauth/callback',
  AUTH_EMAIL_PROVIDER: 'resend',
  AUTH_EMAIL_FROM: 'auth@example.com',
  RESEND_API_KEY: 'fixture',
};

describe('production configuration', () => {
  it('normalizes trailing slashes so configured CORS origins match browser Origin headers', () => {
    const result = envSchema.parse({
      ...production,
      WEB_ORIGIN: production.WEB_ORIGIN + '/',
      API_PUBLIC_URL: production.API_PUBLIC_URL + '/',
    });
    expect(result.WEB_ORIGIN).toBe(production.WEB_ORIGIN);
    expect(result.API_PUBLIC_URL).toBe(production.API_PUBLIC_URL);
  });
  it('accepts HTTPS public URLs and TLS Redis', () =>
    expect(envSchema.parse(production).API_PUBLIC_URL).toBe(
      production.API_PUBLIC_URL,
    ));
  it.each([
    { API_PUBLIC_URL: undefined },
    { WEB_ORIGIN: 'http://localhost:3000' },
    { ATLASSIAN_REDIRECT_URI: 'https://wrong.example.com/callback' },
    { REDIS_URL: 'redis://redis.example.com' },
    { DATABASE_SSL_MODE: 'disable' },
    { AUTH_EMAIL_PROVIDER: 'console' },
    { TRUSTED_PROXY_CIDRS: 'true' },
    { WEB_ORIGIN: 'invalid' },
    { REDIS_URL: 'invalid' },
  ])('fails closed on unsafe configuration %j', (change) => {
    expect(envSchema.safeParse({ ...production, ...change }).success).toBe(
      false,
    );
  });
  it.each(['https://app.example.com', 'http://localhost:3000'])(
    'builds the Jira browser URL from %s',
    (origin) => {
      expect(jiraBrowserRedirect(origin)).toBe(
        origin + '/onboarding/integration?provider=jira',
      );
    },
  );
  it.each(['true', '*', '1', '0.0.0.0/0', '::/0', '127.0.0.1/33'])(
    'rejects broad or malformed proxy trust %s',
    (value) => {
      expect(() => trustedProxyRanges(value)).toThrow();
    },
  );
  it('does not trust spoofed forwarded IPs, but allows an explicitly trusted proxy', async () => {
    for (const [ranges, expected] of [
      [undefined, '127.0.0.1'],
      ['127.0.0.1/32', '203.0.113.10'],
    ] as const) {
      const adapter = new FastifyAdapter({
        trustProxy: trustedProxyRanges(ranges),
      });
      const server = adapter.getInstance();
      server.get('/ip', (request) => ({ ip: request.ip }));
      const response = await server.inject({
        url: '/ip',
        headers: { 'x-forwarded-for': '203.0.113.10' },
      });
      expect(response.json().ip).toBe(expected);
      await server.close();
    }
  });
  it('allows credentials only for the configured web origin, never an arbitrary origin', async () => {
    const adapter = new FastifyAdapter();
    adapter.enableCors({ origin: production.WEB_ORIGIN, credentials: true });
    const server = adapter.getInstance();
    server.get('/cors', () => ({ ok: true }));
    for (const origin of [
      production.WEB_ORIGIN,
      'https://untrusted.example.net',
    ]) {
      const response = await server.inject({
        url: '/cors',
        headers: { origin },
      });
      expect(response.headers['access-control-allow-origin']).toBe(
        production.WEB_ORIGIN,
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      if (origin !== production.WEB_ORIGIN)
        expect(response.headers['access-control-allow-origin']).not.toBe(
          origin,
        );
    }
    await server.close();
  });
  it.each([
    ['production', 'https://api.example.com', true],
    ['development', 'https://api.example.com', true],
    ['development', undefined, false],
  ])(
    'sets and clears matching host-only cookies for %s',
    (environment, publicUrl, secure) => {
      const service = new RefreshCookieService(
        new ConfigService({
          NODE_ENV: environment,
          API_PUBLIC_URL: publicUrl,
          AUTH_REFRESH_TTL_DAYS: 30,
        }) as any,
      );
      const reply = { setCookie: vi.fn(), clearCookie: vi.fn() };
      service.set(reply as any, 'fixture');
      service.clear(reply as any);
      const options = {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/api/v1/auth',
      };
      expect(reply.setCookie).toHaveBeenCalledWith(
        'lumos_refresh_token',
        'fixture',
        { ...options, maxAge: 2592000 },
      );
      expect(reply.clearCookie).toHaveBeenCalledWith(
        'lumos_refresh_token',
        options,
      );
      expect(reply.setCookie.mock.calls[0][2]).not.toHaveProperty('domain');
    },
  );
});
