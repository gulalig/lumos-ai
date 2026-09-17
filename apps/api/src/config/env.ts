import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  API_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3001),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  LIVEKIT_URL: z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith('wss://') ||
        value.startsWith('ws://'),
      {
        message: 'LIVEKIT_URL must use ws:// or wss://',
      },
    ),

  LIVEKIT_API_KEY: z.string().min(1),

  LIVEKIT_API_SECRET: z.string().min(1),

  LIVEKIT_ROOM: z
    .string()
    .min(1)
    .default('lumos-dev'),

  WEB_ORIGIN: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;
