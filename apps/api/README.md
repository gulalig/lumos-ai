# Lumos API

NestJS/Fastify API and embedded semantic execution/Jira workers. Install dependencies once at the repository root with `npm ci`.

From this directory: `npm run migration:run`, then `npm run start:dev`. The default port is 3001; health routes are `/api/v1/health/live` and `/api/v1/health/ready`.

Tests: `npm test` (use an isolated migrated database for integration tests). Build: `npm run build`. Production entrypoint: `node dist/main.js`.

See [repository setup](../../README.md), [Windows development](../../docs/local-development.md), [architecture](../../docs/architecture.md) and [production deployment](../../docs/production-deployment.md). The production Dockerfile is `apps/api/Dockerfile` with the repository root as context.

Never commit real environments or credentials. Database schema changes use the 13 ordered TypeORM migrations; synchronize is disabled.
