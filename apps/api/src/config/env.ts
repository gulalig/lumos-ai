import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  API_PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

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

  ATLASSIAN_TOKEN_ENCRYPTION_KEY: z.string().min(1),
  ATLASSIAN_CLIENT_ID: z
    .string()
    .min(1),

  ATLASSIAN_CLIENT_SECRET: z
    .string()
    .min(1),

  ATLASSIAN_REDIRECT_URI: z
    .string()
    .url(),
});

export type Env = z.infer<typeof envSchema>;
