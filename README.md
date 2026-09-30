# Lumos AI

Lumos is a real-time meeting intelligence assistant. It captures conversation context and commitments, asks for missing information, and turns grounded commitments into sprint execution and Jira issues. A refinement updates the same commitment lineage, SprintItem and Jira mapping; it is not a new task.

## Architecture

```text
Next.js browser / demo WAVs / microphone
                 |
              LiveKit Cloud
                 |
realtime-go -> AssemblyAI -> evidence -> Groq -> meeting actor
                 |                         |
                 +----- Redis Streams -----+
                              |
                      NestJS API workers
                              |
              PostgreSQL SprintItem / Jira outbox
                              |
                         Jira / API snapshot
                              |
                          web UI
```

Production targets: Cloudflare Workers/OpenNext (web), Northflank (API and realtime), Supabase (PostgreSQL), Upstash native Redis TLS, LiveKit Cloud. The API owns authentication, workspaces, execution and Jira synchronization. Go owns audio, transcription, semantic context and speech coordination. See [architecture](docs/architecture.md).

## Repository

- `apps/web`: Next.js App Router, React, Redux Toolkit, MUI, LiveKit client; auth, onboarding, overview, demo, meetings, sprint, activity and admin routes.
- `apps/api`: NestJS/Fastify, TypeORM migrations, PostgreSQL repositories, Redis consumers, OAuth and Jira outbox.
- `services/realtime-go`: long-running Go service with CGO audio codecs/resampling.
- `scripts/redis-compatibility-smoke.mjs`: isolated native Redis compatibility checks.
- `docker-compose.yml`: local PostgreSQL 17 and Redis 7 with persistent volumes.
- `docs`: permanent development, architecture, demo, deployment and security guides.
- `packages` and `infra`: reserved directories; no additional executable service is required. There is no current `apps/worker` service.

## Prerequisites

Use Node **22.22.3**, npm **10+** (verification uses npm 11.19.1), Go **1.27.0**, and Docker Desktop with **Linux containers**. Root engines allow Node >=20/npm >=10, but Node 22 is the supported deployment baseline for Wrangler/OpenNext. Web pins Next **16.3.6**, OpenNext Cloudflare **1.20.7**, Wrangler **4.144.0**.

Go requires `CGO_ENABLED=1`, gcc, pkg-config, Opus, opusfile and soxr; on Windows use MSYS2 UCRT64. On Debian install `build-essential pkg-config libopus-dev libopusfile-dev libsoxr-dev`. See [Windows setup and troubleshooting](docs/local-development.md).

## Local setup

From the root in PowerShell:

```powershell
npm.cmd ci
Copy-Item .env.example .env
# Fill .env with local DB settings and your own provider credentials.
docker compose up -d postgres redis
cd apps/api
npm.cmd run migration:run
npm.cmd run start:dev
```

Start the other services in separate terminals:

```powershell
cd apps/web
# Next runs in this directory; use its ignored .env.local for the public API URL.
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1'
npm.cmd run dev
```

```powershell
cd services/realtime-go
$env:PATH = 'C:\msys64\ucrt64\bin;' + $env:PATH
$env:CC = 'C:/msys64/ucrt64/bin/gcc.exe'
$env:CGO_ENABLED = '1'
go run ./cmd/realtime
```

Local addresses: web `http://localhost:3000`, API `http://localhost:3001/api/v1`, metrics `http://localhost:8081/metrics`, PostgreSQL `127.0.0.1:5432`, Redis `127.0.0.1:6379`. Local API CORS uses `WEB_ORIGIN=http://localhost:3000`. Real provider credentials are needed for a live meeting; local PostgreSQL/Redis are not substitutes for audio/AI services.

## Verification and builds

Run from the named service directory; install npm dependencies once at the repository root.

```powershell
# apps/web
npm.cmd run typecheck
npm.cmd test
# For production builds, provide the intended public HTTPS API URL.
$env:NEXT_PUBLIC_API_URL = 'https://api.example.com/api/v1'
npm.cmd run build
npm.cmd run build:cloudflare

# apps/api
npm.cmd test
npm.cmd run build
npm.cmd run migration:show
npm.cmd audit --omit=dev

# services/realtime-go (with CGO/gcc configured)
go test ./...
go test -race ./internal/observability ./internal/config ./internal/intervention ./internal/speechfloor ./internal/meetingruntime/...
go build ./cmd/realtime

# repository root
$env:REDIS_URL = 'redis://127.0.0.1:6379'
npm.cmd run smoke:redis
docker build -f apps/api/Dockerfile -t lumos-api:production-check .
docker build -f services/realtime-go/Dockerfile -t lumos-realtime:production-check .
git diff --check
npm.cmd run check:docs
```

Integration tests need an **isolated, migrated test database** and local Redis. Never point tests at production. Migrations are the only schema source of truth; `synchronize` and automatic migration execution are disabled. Production images run `node dist/main.js` and `/app/realtime` respectively. The web production target is a Cloudflare Worker, not `next start` on Northflank.

## Deployment and security

Use [the authoritative production handoff](docs/production-deployment.md) and [security checklist](docs/security-production-checklist.md). Do not commit `.env`, private keys, provider credentials, transcripts/debug dumps or build output. `NEXT_PUBLIC_*` values are browser-visible. API/Go secrets belong in service-specific secret groups, never Cloudflare client variables.

## Status

This repository implements the live demo and persistent execution/refinement pipeline. Pre-push verification is not a production deployment or a claim that external accounts, quotas, domains, OAuth or hosted TLS have been validated. [Demo success criteria](docs/demo-flow.md) and the deployment handoff distinguish local checks from required hosted smoke tests.
