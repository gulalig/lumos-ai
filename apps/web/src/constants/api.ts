import { resolvePublicApiUrl } from "@/config/public-api-url";

export const API_CONFIG = {
  baseUrl: resolvePublicApiUrl(
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NODE_ENV,
  ),
} as const;
