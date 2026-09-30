import { z } from 'zod';
import { isPublicHttps, trustedProxyRanges } from './production.js';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    API_PORT: z.coerce.number().int().positive().default(3001),

    DATABASE_URL: z.string().min(1),
    DATABASE_SSL_MODE: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['disable', 'verify-full']).optional(),
    ),
    DATABASE_SSL_CA_FILE: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),

    REDIS_URL: z
      .string()
      .url()
      .refine((value) => {
        try {
          return ['redis:', 'rediss:'].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, 'Use a native redis:// or rediss:// URL'),

    LIVEKIT_URL: z
      .string()
      .url()
      .refine(
        (value) => value.startsWith('wss://') || value.startsWith('ws://'),
        {
          message: 'LIVEKIT_URL must use ws:// or wss://',
        },
      ),

    LIVEKIT_API_KEY: z.string().min(1),

    LIVEKIT_API_SECRET: z.string().min(1),

    WEB_ORIGIN: z.string().url(),
    API_PUBLIC_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    TRUSTED_PROXY_CIDRS: z.string().optional(),

    JWT_ACCESS_SECRET: z.string().min(32),

    JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),

    AUTH_OTP_PEPPER: z.string().min(32),

    AUTH_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

    ATLASSIAN_TOKEN_ENCRYPTION_KEY: z.string().min(1),
    ATLASSIAN_CLIENT_ID: z.string().min(1),

    ATLASSIAN_CLIENT_SECRET: z.string().min(1),

    ATLASSIAN_REDIRECT_URI: z.string().url(),
    AUTH_EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),

    AUTH_EMAIL_FROM: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().email().optional(),
    ),

    RESEND_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),

    PLATFORM_ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),

    PLATFORM_ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).optional(),

    PLATFORM_ADMIN_BOOTSTRAP_NAME: z.string().min(1).optional(),
  })
  .superRefine((env, context) => {
    const issue = (path: keyof typeof env, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    try {
      trustedProxyRanges(env.TRUSTED_PROXY_CIDRS);
    } catch {
      issue(
        'TRUSTED_PROXY_CIDRS',
        'Use only explicitly trusted proxy IPs/CIDRs',
      );
    }
    for (const name of ['WEB_ORIGIN', 'API_PUBLIC_URL'] as const) {
      const value = env[name];
      if (!value) continue;
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        continue;
      }
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        issue(
          name,
          'Must be an HTTP(S) origin without credentials, path, query or fragment',
        );
      }
    }
    if (env.NODE_ENV !== 'production') return;
    for (const name of [
      'WEB_ORIGIN',
      'API_PUBLIC_URL',
      'ATLASSIAN_REDIRECT_URI',
    ] as const) {
      if (!env[name] || !isPublicHttps(env[name]))
        issue(name, 'Production requires a public HTTPS URL');
    }
    if (
      env.API_PUBLIC_URL &&
      isPublicHttps(env.API_PUBLIC_URL) &&
      env.ATLASSIAN_REDIRECT_URI !==
        new URL(
          '/api/v1/integrations/jira/oauth/callback',
          env.API_PUBLIC_URL,
        ).toString()
    ) {
      issue(
        'ATLASSIAN_REDIRECT_URI',
        'Must match the public API Jira callback URL exactly',
      );
    }
    if (!env.REDIS_URL.startsWith('rediss://'))
      issue('REDIS_URL', 'Production requires native Redis TLS (rediss://)');
    if (!env.LIVEKIT_URL.startsWith('wss://'))
      issue('LIVEKIT_URL', 'Production requires wss://');
    if (env.DATABASE_SSL_MODE === 'disable')
      issue(
        'DATABASE_SSL_MODE',
        'Production PostgreSQL TLS cannot be disabled',
      );
    if (
      env.AUTH_EMAIL_PROVIDER !== 'resend' ||
      !env.AUTH_EMAIL_FROM ||
      !env.RESEND_API_KEY
    ) {
      issue(
        'AUTH_EMAIL_PROVIDER',
        'Production requires Resend, AUTH_EMAIL_FROM and RESEND_API_KEY; console would log OTPs',
      );
    }
  })
  .transform((env) => ({
    ...env,
    WEB_ORIGIN: new URL(env.WEB_ORIGIN).origin,
    ...(env.API_PUBLIC_URL
      ? { API_PUBLIC_URL: new URL(env.API_PUBLIC_URL).origin }
      : {}),
  }));

export type Env = z.infer<typeof envSchema>;
