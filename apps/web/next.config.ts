import type { NextConfig } from "next";
import { resolvePublicApiUrl } from "./src/config/public-api-url";

resolvePublicApiUrl(process.env.NEXT_PUBLIC_API_URL, process.env.NODE_ENV);

const nextConfig: NextConfig = {/* config options here */};

export default nextConfig;
