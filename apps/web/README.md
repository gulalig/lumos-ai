# Lumos web

Next.js App Router UI for Lumos AI. Current versions: Next 16.3.6, OpenNext Cloudflare 1.20.7 and Wrangler 4.144.0.

Install once at the repository root with `npm ci`. From this directory, `npm run dev` serves localhost:3000. Configure the public API base in the shell or ignored `.env.local`; production builds require HTTPS `NEXT_PUBLIC_API_URL` ending in `/api/v1`.

Checks: `npm run typecheck`, `npm test`, `npm run build`, `npm run build:cloudflare`. Local Worker preview: `npm run preview:cloudflare`. Do not deploy without approval.

The supported production target is Cloudflare Workers/OpenNext, not a static export. See [repository setup](../../README.md), [local development](../../docs/local-development.md), [demo flow](../../docs/demo-flow.md) and [production deployment](../../docs/production-deployment.md).

Branding reuses `public/lumos_logo.svg` unchanged as `src/app/icon.svg`; server metadata uses the Lumos AI title template. Browser configuration must never contain provider secrets.
