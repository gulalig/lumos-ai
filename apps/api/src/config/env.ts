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
});

export type Env = z.infer<typeof envSchema>;
