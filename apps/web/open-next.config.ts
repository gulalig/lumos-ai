import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The current app uses no ISR, revalidateTag/path, or server-side data cache.
// Add an R2 incremental cache binding before introducing those features.
export default defineCloudflareConfig();
