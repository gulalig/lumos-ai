import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA = 'lumos:rate-limit';

export type RateLimitScope = 'ip' | 'user';

export interface RateLimitOptions {
  namespace: string;

  limit: number;

  windowSeconds: number;

  scope: RateLimitScope;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA, options);
