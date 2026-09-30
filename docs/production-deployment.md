# Lumos production deployment handoff

Authoritative for the current source tree, prepared 2026-09-30. This guide describes a **future deployment**; it does not imply deployment, hosted connectivity or provider account validation has occurred. No real secrets are included. Read [architecture](architecture.md), [local development](local-development.md), [demo flow](demo-flow.md) and [security checklist](security-production-checklist.md) alongside this handoff.

## 1. Architecture and responsibilities

| Component | Source / target | Responsibility and persistent truth |
| --- | --- | --- |
| Web | `apps/web` / Cloudflare Workers with OpenNext | Next App Router, auth/onboarding, live demo and microphone, LiveKit client, snapshot/dashboard UI; no fake execution state |
| API | `apps/api` / Northflank `lumos-api` | NestJS/Fastify auth/JWT/cookies, workspaces/usage/admin, meeting lifecycle/tokens, semantic execution, PostgreSQL writes, intervention publication, Jira OAuth/outbox/sync |
| Realtime | `services/realtime-go` / Northflank `lumos-realtime` | Continuous Go process; LiveKit audio, AssemblyAI final transcripts, evidence, Groq semantics, durable actor context/refinement, floor/barge-in, Edge TTS |
| PostgreSQL | Supabase, Frankfurt | Identity, meetings, SprintItems, observation links, Jira mappings/outbox and encrypted OAuth state |
| Redis | Upstash, Frankfurt, native TCP/TLS | Durable streams, actor checkpoints, fenced leases, gaps, delivery markers, cursors, rate limits; not disposable cache |
| LiveKit Cloud | One project shared by API/Go | Human/demo/bot room transport and scoped browser tokens |
| AssemblyAI / Groq | Go only | Streaming speech-to-text / primary+fallback structured semantic extraction |
| Edge TTS | Go only | Implemented library-backed speech synthesis; no API-key variable, no contracted SLA assumed |
| Atlassian / Jira | API only | OAuth 3LO and updates of the existing mapped issue per logical commitment |
| Resend | API only | Production verification/password-reset email; console provider is development-only |

`packages`/`infra` are reserved folders, not additional runtime services. `apps/worker` has been removed; API workers run inside NestJS. One semantic lineage maps to one SprintItem and one Jira issue; refinements update existing IDs.

## 2. Toolchains, build contexts and commands

Use Node **22.22.3**, npm **>=10**, Go **1.27.0**, PostgreSQL **17** for local validation, Redis **7+** command semantics and Docker Linux containers. Root package engines allow Node >=20, but deployment/build tooling uses Node 22. Web currently pins Next **16.3.6**, OpenNext **1.20.7**, Wrangler **4.144.0**. Do not independently install or update dependencies in a service directory without the root lockfile.

Install at repository root: `npm ci`. Commands below are POSIX/CI spelling; Windows uses `npm.cmd`/`npx.cmd` with identical arguments.

| Service | Working directory | Build | Production start / hosting |
| --- | --- | --- | --- |
| Web | `apps/web` | `npm run build`; Cloudflare artifact: `npm run build:cloudflare` (also invokes Next build) | Worker `.open-next/worker.js` via Cloudflare; `npx opennextjs-cloudflare deploy` **only when deployment is approved** |
| Web local Node preview | `apps/web` | `npm run build` | `npm start` = `next start`, not the Cloudflare production deployment path |
| API | `apps/api` | `npm run build` = `nest build` | `node dist/main.js`; `npm run start:prod` resolves the same entrypoint |
| Go | `services/realtime-go` | `CGO_ENABLED=1 go build ./cmd/realtime` | Linux image `/app/realtime`; local compiled binary `./realtime` or Windows `.\realtime.exe` |

Production web build requires a configured HTTPS `NEXT_PUBLIC_API_URL` ending in `/api/v1`. Local Next development retains the localhost fallback; production rejects localhost/missing API configuration. `next/font/google` fetches Geist during builds, so build hosts need network access.

Exact Dockerfiles and **root build context**:

```sh
docker build -f apps/api/Dockerfile -t lumos-api:production-check .
docker build -f services/realtime-go/Dockerfile -t lumos-realtime:production-check .
```

API: Node bookworm multi-stage dependency/build/prune/runtime stages. Only current API/web manifests are copied for workspace resolution. Runtime uses production dependencies, CA certificates and `USER node`; no source .env or build arguments containing secrets.

Go: Go bookworm Linux build, `CGO_ENABLED=1`, gcc/build-essential, pkg-config, `libopus-dev`, `libopusfile-dev`, `libsoxr-dev`. Final Debian slim has CA certificates, `libopus0`, `libopusfile0` and `libsoxr0` (including package-managed transitive libraries), verifies shared-library resolution with `ldd`, runs UID 10001, and uses exec-form `CMD` / `STOPSIGNAL SIGTERM`. No Windows/MSYS paths are used in the image.

`.dockerignore` excludes Git, environments, private keys/certificates, logs, caches, binaries and scratch exports. Images contain no persistent meeting state; only PostgreSQL/Redis do. Builds need registry/apt/Go-module access.

## 3. Ports, health and metrics

| Component | Listen / public exposure | Checks |
| --- | --- | --- |
| Web | Next dev/Node default 3000; Cloudflare public HTTPS 443 | HTTP landing/login checks; no bespoke app health endpoint |
| API | `0.0.0.0:3001` default `API_PORT`; Northflank public HTTPS ingress -> 3001 | `GET /api/v1/health/live` (200); `GET /api/v1/health/ready` (200 when PostgreSQL/Redis healthy, otherwise 503) |
| Go | `:8081` default `REALTIME_PORT`; **private only recommended** | `GET /metrics`; no implemented `/health` or `/ready` endpoint. Private TCP check or authorized metrics HTTP check |
| PostgreSQL | Session Pooler TCP 5432 | Verified TLS connection / migration ledger / query |
| Redis | Provider-assigned native TCP TLS port | TLS PING and compatibility smoke |

API Docker HEALTHCHECK uses local liveness; configure Northflank readiness separately. API readiness does not test Jira/LiveKit/Groq/AssemblyAI/Resend. Go starts metrics after startup checks for Redis, LiveKit and AssemblyAI; its metrics socket is not a continuous provider-health guarantee.

`observability.ProtectMetrics(metrics.Handler(), cfg.MetricsBearerToken)` wraps only the HTTP metrics route. With a token, require exactly `Authorization: Bearer <token>`; missing/invalid credentials return 401 plus `WWW-Authenticate: Bearer`. Both supplied/configured tokens are SHA-256 hashed to fixed-length values and compared with `crypto/subtle.ConstantTimeCompare`. Credentials are neither logged nor included in responses. Without a token, the internal handler is returned unchanged.

Production startup requires **a token OR explicit `METRICS_PRIVATE_ONLY=true`**. Prefer a token **and** private networking. `METRICS_PRIVATE_ONLY` is an operator assertion, not a firewall, CIDR filter or automatic loopback binding: the listener is on all container interfaces. Never attach public ingress to an unauthenticated metrics port. Do not trust forwarded IP headers for metrics authorization. Monitoring credentials are secrets.

## 4. Complete environment reference

Scope: all application env-schema/config reads, checked against current source, plus framework/deployment/local tool variables needed to operate it. Secret values must be injected, never committed. Examples are formats/placeholders, not usable production credentials.

**Classification:** public = non-secret configuration (not necessarily browser-exposed); secret = credentials/credential-bearing URLs/private data. Only `NEXT_PUBLIC_API_URL` is intentionally in the browser bundle. API/Go rows are runtime variables on their named Northflank service; web API URL is a **build-time** variable and must be rebuilt if changed. Optional with a default means omit, not necessarily assign an empty string.

### apps/web

| Variable | Required / default | Class | Purpose and local example | Production source / location |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Required production; dev fallback `http://localhost:3001/api/v1` | Public/browser | API base URL, local `http://localhost:3001/api/v1` | Public API custom domain: `https://api.<domain>/api/v1`; Cloudflare build environment |
| `NODE_ENV` | Managed by Next (development/build production) | Public | Framework mode; `development` locally | Let Next/build scripts set production; do not force development at Worker runtime |
| `PORT` | Optional; Next default 3000 | Public | Local/Node preview port, `3000`; `--port` overrides | Not used as a Cloudflare listening port |
| `NEXT_TELEMETRY_DISABLED` | Optional framework setting; unset default | Public | Optional build telemetry opt-out, `1` | Cloudflare/CI build environment if desired |
| `CLOUDFLARE_ACCOUNT_ID` | Required CLI/CI account selection when deploying | Public/server tooling | Account identifier format `<account-id>` | Cloudflare account dashboard; CI/build deployment configuration |
| `CLOUDFLARE_API_TOKEN` | Required noninteractive CLI deploy; interactive login alternative | Secret/tooling | Scoped Worker deployment credential, `<deployment-token>` | Cloudflare API Tokens; CI secret store, not app/browser variables |
| `NEXTJS_ENV` | Optional OpenNext preview env-file selection; adapter default production | Public/tooling | Optional ignored `.dev.vars` value `development` | Preview tooling only; not a Lumos business-runtime variable |

There is no current manifest file or required PWA binding. Branding uses the real `public/lumos_logo.svg` copied unchanged to App Router `src/app/icon.svg`. Root metadata defaults to **Lumos AI** with **%s | Lumos AI**, description and text-only OG/Twitter metadata; no fake social-preview assets.

### apps/api

| Variable | Required / default | Class | Purpose / local example format | Production source -> Northflank lumos-api |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Set production; schema default development | Public | Runtime safety mode, `development` locally | Service runtime env `production` |
| `API_PORT` | Optional / 3001 | Public | HTTP bind port, `3001` | Service port env; must match Northflank port |
| `DATABASE_URL` | Required / none | Secret | PostgreSQL DSN, `postgresql://<user>:<password>@127.0.0.1:5432/<db>` | Supabase Connect -> Session Pooler DSN, secret |
| `DATABASE_SSL_MODE` | Optional / production verified TLS; dev plaintext absent URL SSL flags | Public | `disable` for local Docker; `verify-full` for hosted DB | Set `verify-full`; production forbids disable/no-verify |
| `DATABASE_SSL_CA_FILE` | Optional / system trust unless CA supplied | Public path; CA mount is managed material | PEM CA path, `C:/certs/supabase-ca.crt` | Supabase CA certificate secret-file mount, e.g. `/run/secrets/supabase-ca.crt` if needed |
| `REDIS_URL` | Required / none | Secret | Native local `redis://127.0.0.1:6379` | Upstash native endpoint/password -> `rediss://default:<password>@<host>:<port>` |
| `LIVEKIT_URL` | Required / none | Public/server | `wss://<project>.livekit.cloud` (local LK may use ws) | LiveKit Cloud project WebSocket URL |
| `LIVEKIT_API_KEY` | Required / none | Secret/server credential | `<livekit-api-key>` | LiveKit project Keys -> secret |
| `LIVEKIT_API_SECRET` | Required / none | Secret | `<livekit-api-secret>` | Same LiveKit key pair -> secret |
| `WEB_ORIGIN` | Required / none | Public | Exact CORS/browser-return origin, `http://localhost:3000` | Final web origin `https://app.<domain>`; no path/query |
| `API_PUBLIC_URL` | Required production; optional development / none | Public | API origin, `http://localhost:3001` | Final API origin `https://api.<domain>`; no `/api/v1` path |
| `TRUSTED_PROXY_CIDRS` | Optional / no proxy trust | Public/server | Comma-separated **verified** proxy IPs/CIDRs; omit locally | Northflank ingress information; do not invent ranges or use wildcard/hop count |
| `JWT_ACCESS_SECRET` | Required / none | Secret | Signing material, `<random-at-least-32-characters>` | Independently generated, stable shared API secret |
| `JWT_ACCESS_EXPIRES_IN` | Optional / `15m` | Public/server | Access JWT lifetime, `15m` | API policy/env |
| `AUTH_OTP_PEPPER` | Required / none | Secret | OTP hashing pepper, `<different-random-at-least-32-characters>` | Independently generated stable API secret |
| `AUTH_REFRESH_TTL_DAYS` | Optional / 30 | Public/server | Refresh session/cookie lifetime, `30` | API auth policy/env |
| `ATLASSIAN_TOKEN_ENCRYPTION_KEY` | Required / none | Secret | Base64 of **exactly 32 random bytes**, `<base64-32-byte-key>` | Generated/stable secret; back up with encrypted token data |
| `ATLASSIAN_CLIENT_ID` | Required / none | Public/server | OAuth app ID, `<atlassian-client-id>` | Atlassian Developer Console OAuth app |
| `ATLASSIAN_CLIENT_SECRET` | Required / none | Secret | OAuth client credential, `<atlassian-client-secret>` | Same app Credentials -> secret |
| `ATLASSIAN_REDIRECT_URI` | Required / none | Public | `http://localhost:3001/api/v1/integrations/jira/oauth/callback` locally | `https://api.<domain>/api/v1/integrations/jira/oauth/callback`, registered exactly |
| `AUTH_EMAIL_PROVIDER` | Optional local / console; required production resend | Public/server | `console` logs OTPs locally | Set `resend`; console is rejected in production |
| `AUTH_EMAIL_FROM` | Required for Resend/production / none | Public | Plain verified sender email, `login@example.com` | Resend verified domain/sender -> env |
| `RESEND_API_KEY` | Required for Resend/production / none | Secret | `<resend-api-key>` | Resend API Keys -> secret |
| `PLATFORM_ADMIN_BOOTSTRAP_EMAIL` | Optional / none | Secret/private identity | One-time admin email, `admin@example.com` | Operator-chosen restricted bootstrap env; remove after first creation |
| `PLATFORM_ADMIN_BOOTSTRAP_PASSWORD` | Optional, paired with email / none | Secret | Unique password >=12 chars, `<unique-bootstrap-password>` | Operator-generated secret; remove after provisioning |
| `PLATFORM_ADMIN_BOOTSTRAP_NAME` | Optional / Lumos Admin when bootstrap runs | Public/private profile | Admin display name, `Platform Admin` | Operator bootstrap env |

Blank optional bootstrap fields are not equivalent to omitted values. Do not attach Go-only Groq/AssemblyAI/TTS secrets to the API.

### services/realtime-go

| Variable | Required / default | Class | Purpose / local example format | Production source -> Northflank lumos-realtime |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Set production; Go default empty (local policy) | Public | `development` locally; validates development/test/production when set | Docker/runtime sets `production` |
| `REDIS_URL` | Required / none | Secret | `redis://127.0.0.1:6379` locally | Same Upstash native `rediss://` URL used by API |
| `LIVEKIT_BOT_IDENTITY` | Required / none | Public/server | Assistant identity, `lumos` | Operator-defined; unique from human/demo identities |
| `LIVEKIT_URL` | Required / none | Public/server | `wss://<project>.livekit.cloud` | Same Cloud project as API |
| `LIVEKIT_API_KEY` | Required / none | Secret | `<livekit-api-key>` | LiveKit Keys -> secret |
| `LIVEKIT_API_SECRET` | Required / none | Secret | `<livekit-api-secret>` | LiveKit Keys -> secret |
| `ASSEMBLYAI_API_KEY` | Required / none | Secret | `<assemblyai-api-key>` | AssemblyAI dashboard API key -> secret |
| `ASSEMBLYAI_STREAMING_URL` | Optional / `wss://streaming.assemblyai.com/v3/ws` | Public/server | Streaming endpoint; local example is default | Provider endpoint, production requires wss; review data-region requirements |
| `SEMANTIC_PROVIDER` | Optional / `groq` | Public/server | Implemented provider selection, `groq` | Keep groq; other providers are not implemented |
| `GROQ_API_KEY` | Required with groq / none | Secret | `<groq-api-key>` | Groq console API Keys -> secret |
| `GROQ_BASE_URL` | Optional / `https://api.groq.com/openai/v1` | Public/server | Compatible API endpoint; example is default | Provider endpoint, production HTTPS |
| `GROQ_MODEL` | Optional / `openai/gpt-oss-20b` | Public/server | Primary extraction model; example is default | Go runtime env; verify account model access |
| `GROQ_FALLBACK_MODEL` | Optional / `openai/gpt-oss-120b` | Public/server | Fallback extraction model; example is default | Go runtime env; verify quota/model access |
| `TTS_PROVIDER` | Optional / `edge` | Public/server | Implemented speech provider, `edge` | Keep edge unless a new provider is actually implemented |
| `TTS_LANGUAGE` | Optional / `en-US` | Public/server | Speech language; example is default | Go runtime env |
| `TTS_VOICE` | Optional / `en-US-AriaNeural` | Public/server | Voice; example is default | Go runtime env |
| `TTS_RATE` | Optional / `+0%` | Public/server | Rate modifier; example is default | Go runtime env |
| `TTS_VOLUME` | Optional / `+0%` | Public/server | Volume modifier; example is default | Go runtime env |
| `TTS_TIMEOUT` | Optional / `8s` | Public/server | Positive Go duration for synthesis; `8s` | Go runtime env |
| `TTS_MAX_RETRIES` | Optional / 2 (allowed 0..5) | Public/server | Provider retries; `2` | Go runtime env |
| `REALTIME_PORT` | Optional / 8081 | Public/server | Metrics listener; `8081` | Private service port config |
| `METRICS_BEARER_TOKEN` | Required production unless private-only true / none | Secret | `<random-metrics-token>`; blank only for allowed dev/private deployment | Independently generated monitoring secret |
| `METRICS_PRIVATE_ONLY` | Optional / false | Public/server | Literal `true` explicitly asserts private port; `false` locally | Set true only with enforced private networking; token still applies if configured |

`services/realtime-go/.env.example` lists all Go runtime variables. There is **no** currently used `WEB_APP_URL`, `JIRA_OAUTH_CALLBACK_URL`, `EDGE_TTS_API_KEY`, Supabase browser service-role key or Upstash REST token variable. Use the canonical names above.

### Local infrastructure and build tool variables

`POSTGRES_USER`, `POSTGRES_PASSWORD` (secret), `POSTGRES_DB` are required by root Docker Compose with no defaults; local formats `lumos` / `<local-password>` / `lumos`. They initialize local Postgres, not Supabase; production uses `DATABASE_URL` instead.

`WEB_PORT` in root `.env.example` is a local convenience with example 3000, **not read by current Next code**; use `PORT`/`--port`. Do not attach it as an assumed Worker setting.

Go build tools: `CGO_ENABLED=1`, `CC=gcc`, `PKG_CONFIG=pkg-config`, `PKG_CONFIG_PATH=<native-lib/pkgconfig>`, compiler library `PATH`; all non-secret build config. Docker sets `GOWORK=off` and `GOTOOLCHAIN=local` to build the service module with the pinned installed toolchain. Windows MSYS paths are local-only. `REDIS_URL` also configures the root compatibility smoke; test `DATABASE_URL`/`REDIS_URL` must be explicitly isolated, never production.

## 5. Supabase PostgreSQL: Frankfurt / Session Pooler

Create the project in **Frankfurt**. Select **Session Pooler** in the Connect dialog and copy its native PostgreSQL URI (port **5432**, not transaction pooler 6543). The shared pooler provides IPv4 connectivity when the direct DB host requires IPv6; long-running API/migration sessions need normal PostgreSQL session semantics. Do not assume the direct host works from the Northflank build/runtime network. [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits).

Format only, using the **actual host from your dashboard** and a URL-encoded password:

```text
postgresql://postgres.<project-ref>:<encoded-password>@<session-pooler-host>:5432/postgres
```

Set `DATABASE_SSL_MODE=verify-full` and enable provider SSL enforcement. Production code verifies certificates and never uses `rejectUnauthorized=false`. If the endpoint requires the project CA, download the public Supabase CA and mount it in API **and migration jobs**, configuring `DATABASE_SSL_CA_FILE`. Use the provider's correct DNS hostname, not a bare IP. [Supabase SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

The shared database-options helper is used by TypeORM, the health/query `pg.Pool` and compiled migrations. It strips URL SSL options before applying the verified SSL object to prevent connection-string options replacing that policy. Local Docker Postgres can use `DATABASE_SSL_MODE=disable` outside production.

The API has both ORM and query/health connections; session pooling still consumes backend capacity. Budget connections across all API replicas, migration jobs and admin tools before scaling. Supabase API/service-role browser credentials are **not** required by this architecture.

Migrations are the only schema authority. Both `synchronize` and `migrationsRun` are false. Run migrations once before enabling API traffic/workers, not concurrently from every replica. Back up the database and encryption keys, confirm restore availability on the selected plan, and review reversible changes before release. Free-tier backups/PITR/availability are not assumed.

## 6. All 13 current database migrations

Directory: `apps/api/src/database/migrations`. Each filename below has `.ts`; compiled images have the same basename `.js`. The exported class is the descriptive basename followed by the timestamp, listed explicitly.

| Order / filename | Exported class | Purpose |
| --- | --- | --- |
| 1. `1790013499886-InitialMeetingsBaseline.ts` | `InitialMeetingsBaseline1790013499886` | Meetings baseline, room uniqueness/status/indexes |
| 2. `1790017200000-AddWorkspaceIdentityModel.ts` | `AddWorkspaceIdentityModel1790017200000` | Users, workspaces, members, participant identity and workspace-bound meetings |
| 3. `1790167587862-AddSprintDomain.ts` | `AddSprintDomain1790167587862` | Sprints and SprintItems |
| 4. `1790172145823-AddJiraMappings.ts` | `AddJiraMappings1790172145823` | Unique item/issue and sprint/Jira mappings |
| 5. `1790173551168-AddExecutionObservationLinks.ts` | `AddExecutionObservationLinks1790173551168` | Semantic observation-to-item execution links/idempotency |
| 6. `1790329622346-AddAtlassianConnections.ts` | `AddAtlassianConnections1790329622346` | Workspace Atlassian/OAuth connection storage |
| 7. `1790331000000-AddJiraSyncOutbox.ts` | `AddJiraSyncOutbox1790331000000` | Durable Jira synchronization outbox/jobs |
| 8. `1790410000000-AddAuthFoundation.ts` | `AddAuthFoundation1790410000000` | Password/email verification and auth session/OTP foundation |
| 9. `1790420000000-AddWorkspaceUsagePolicies.ts` | `AddWorkspaceUsagePolicies1790420000000` | Workspace enablement, trial/meeting limits and feature gating |
| 10. `1790430000000-MakeUserDisplayNameOptional.ts` | `MakeUserDisplayNameOptional1790430000000` | Nullable user display name for signup/onboarding |
| 11. `1790568000000-AddOnboardingProfileFields.ts` | `AddOnboardingProfileFields1790568000000` | Workspace industry/company size/website/use-case fields |
| 12. `1790625600000-AddSignupConsentFields.ts` | `AddSignupConsentFields1790625600000` | Terms acceptance and newsletter opt-in |
| 13. `1790700000000-AddPlatformAdmins.ts` | `AddPlatformAdmins1790700000000` | Platform administrator identity/auth table |

Local commands from `apps/api` (they build first):

```sh
npm run migration:show
npm run migration:run
npm run migration:revert
```

A production image excludes the Nest dev compiler. Use the **already compiled** CLI from image working directory `/app/apps/api`:

```sh
node /app/node_modules/typeorm/cli.js -d dist/database/data-source.js migration:show
node /app/node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run
# Reviewed emergency rollback only: reverts the last migration, not the full release.
node /app/node_modules/typeorm/cli.js -d dist/database/data-source.js migration:revert
```

Ledger: `typeorm_migrations`. Release procedure: backup -> stop/drain affected work -> inspect pending migrations -> run once under the release DB/TLS configuration -> confirm all 13 applied -> start compatible API -> verify readiness -> start realtime. Never run a clean-database test against the production DSN. Do not modify an already-applied migration as a future migration strategy; existing local edits must be reviewed before the first release.

## 7. Upstash Redis: Frankfurt / native TCP TLS

Create a database in **Frankfurt**, select a plan supporting the required native operations and get its endpoint/password from the dashboard. Inject `REDIS_URL=rediss://default:<encoded-password>@<host>:<port>` in API and Go. Use the dashboard's port, not an assumed one. TLS certificate verification remains enabled; Go sets minimum TLS 1.2.

**Do not use the REST URL/token or `@upstash/redis` for this implementation.** The app uses native ioredis/go-redis and blocking streams. Upstash documents REST limitations for blocking `XREAD`/`XREADGROUP`; native protocol compatibility must be checked against the configured instance. [Native compatibility](https://upstash.com/docs/redis/overall/compatibility), [REST differences](https://upstash.com/docs/redis/features/restapi).

### Explicit compatibility checklist

| Commands / features | Current dependency | Smoke coverage / production gate |
| --- | --- | --- |
| `PING`, native auth/TLS | Startup/dependency checks | Connect/PING; use rediss for hosted smoke |
| `SET`/`GET`, `NX`/`PX`, `PSETEX` | Cursors, leases, dedupe/state | Isolated key writes/read + expiries |
| `HSET`/`HGET`/`HGETALL`/`HINCRBY` | Gaps/state/counters | Hash round trip/counter |
| `DEL`, `EXISTS`, `TYPE` | Cleanup/atomic state validation | Exact namespace checks and finally cleanup |
| `TTL`/`PTTL`/`EXPIRE`/`PEXPIRE` | Retention, leases, dedupe/rate limit | Expiry assertions |
| `INCR` | Fences/counters/rate limits | Lua counter/expiry |
| `XADD` | Lifecycle/evidence/semantics/interventions/DLQ | Stream publication, also inside Lua |
| `XREAD` including `BLOCK` | Durable readers | Native blocking-form read |
| `XREADGROUP` including `BLOCK` | Evidence/intervention consumers | Group delivery/pending entry |
| `XGROUP CREATE MKSTREAM` | Consumer bootstrap | Isolated group creation |
| `XACK` | Durable evidence/delivery completion | Group ACK, also in atomic Lua |
| `XAUTOCLAIM` | Pending recovery | Claim pending entry, verify response shape |
| `XPENDING` (summary/range) | Recovery/metrics/atomic pending validation | Both reply shapes, including Lua |
| `XRANGE`/`XREVRANGE` | Replay/history/projector/execution | Forward/reverse range read |
| `XINFO GROUPS` | Consumer lag/pending observability | Group response/lag shape |
| `EVAL` / Redis Lua | Fenced ownership, checkpoint/result+ACK, delivery/gaps, rate limits | Multi-key atomic script with TYPE, XPENDING, INCR, expiry, SET, HSET, XADD and XACK; error-reply handling |
| Pipeline; `MULTI`/`EXEC` | Batched state operations | Both execution/result/error shapes |

Meeting keys use matching hash tags for multi-key atomic work. Go uses RESP2 and disables unsupported client identity negotiation. No replacement of the Redis Streams architecture is intended.

Compatibility script: `scripts/redis-compatibility-smoke.mjs`. Safe smoke from root:

```powershell
# Local verification only:
$env:REDIS_URL = 'redis://127.0.0.1:6379'
npm.cmd run smoke:redis
```

For a **separately authorized** hosted compatibility check, inject the configured Upstash native URL through a secret environment variable and run the same script. It does not auto-load .env, uses UUID-scoped keys with 60-second TTL and deletes only its own exact keys in finally; no FLUSH, KEYS or broad production deletion. It logs check names, not credentials. A local Redis pass does not establish Upstash compatibility, hosted TLS or quotas.

Redis retains live business pipeline state, including replayable transcripts. Preserve persistence and avoid eviction/data loss of active state. Upstash durable service storage is not a substitute for a retention/backup plan. No complete automatic stream archival/purge policy is claimed.

Free command/storage/bandwidth and throttling limits can delay or reject durable work. The current [pricing page](https://upstash.com/pricing/redis) lists free storage/bandwidth constraints; historical FAQ limits differ from newer pricing. Confirm command budget and native connection limits in the dashboard rather than relying on stale daily quotas. Repeated API polling, leases, metrics, Lua and stream reads consume budget even during small demos.

## 8. Northflank setup

For this rollout, use **one free project**, **London**, with two services:

- `lumos-api`: root context `.`; Dockerfile `apps/api/Dockerfile`.
- `lumos-realtime`: root context `.`; Dockerfile `services/realtime-go/Dockerfile`.

London is the selected free-account region because Frankfurt requires a paid plan **for this rollout**. Region availability/entitlements must be checked in your account; this guide has not provisioned or independently verified that account. The public region list is not proof of free-plan eligibility. [Project setup](https://northflank.com/docs/v1/application/getting-started/create-a-project).

The Developer Sandbox allows two services and jobs, but Northflank explicitly says its free tier should not be used for production applications. Treat the free target as a staging/demo constraint, not a production SLA; accept/upgrade this risk before a real public launch. [Northflank billing guidance](https://northflank.com/docs/v1/application/billing/pricing-on-northflank).

Attach separate secret groups to each service using the environment reference. Shared LiveKit/Redis credentials must match; API-only database/Jira/auth/email values and Go-only AI/metrics values should not be unnecessarily duplicated. Inject secrets at **runtime**, not build args.

Configure:

- API HTTP port 3001 public through Northflank TLS/custom API domain; liveness `/api/v1/health/live` and readiness `/api/v1/health/ready`. Respect `API_PORT` if changed.
- Realtime port 8081 **private**, no public hostname. Monitor `/metrics` privately with bearer credentials, or configure a TCP probe. Do not configure an nonexistent HTTP `/health` check or an unauthenticated HTTP probe against token-protected metrics.
- Both services are long-running. Keep at least one active replica, do not use request-driven/scale-to-zero execution for Go. Start with one API and one Go replica until resource/connection/worker capacity is validated.
- Allow outbound PostgreSQL/Redis TLS, LiveKit/WebRTC and HTTPS/WebSocket access to AssemblyAI/Groq/Edge/Atlassian/Resend. Do not require inbound public media traffic on the Go HTTP port; audio goes through LiveKit.
- Container filesystems are ephemeral. No persistent volume is required for either app; providers/data services retain state. Do not rely on local audio/debug files after restart.
- Preserve exec-form container starts and SIGTERM. Allow at least **30 seconds** shutdown grace: Go has 5-second metrics shutdown plus 15-second supervisor wait and runtime cancellation; API enables Nest shutdown hooks.
- Configure restart-on-failure/continuous service management explicitly; provider platform policy must not silently suspend the runtime. Verify leases/checkpoints recover after a deliberate staging restart.
- Verify trusted proxy behavior with actual ingress CIDRs. Do not set `TRUSTED_PROXY_CIDRS` to `*`, `true`, a hop count or an entire unrestricted network.

A migration job can use the API image and compiled TypeORM command without consuming a third continuous service. Gate traffic/worker activation until migration succeeds.

## 9. Cloudflare / OpenNext web

Use **Cloudflare Workers**, not a static Pages export or legacy `@cloudflare/next-on-pages`. Repository files: `apps/web/open-next.config.ts`, `apps/web/wrangler.jsonc` and `apps/web/public/_headers`. The Worker name is `lumos-web`; main is `.open-next/worker.js`, assets are `.open-next/assets`, `nodejs_compat` is enabled and the self-reference service binding matches the Worker name.

The installed adapter supports the repo's pinned **Next 16.3.6**. Preserve local `next dev` behavior. [OpenNext configuration guide](https://opennext.js.org/cloudflare/get-started).

From root install `npm ci`; run from `apps/web`:

```sh
# Set NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1 in the build environment.
npm run typecheck
npm test
npm run build
npm run build:cloudflare
npm run preview:cloudflare
# Only after explicit deployment authorization:
npx opennextjs-cloudflare deploy
```

Preview is local, not deployment. Prefer Linux CI for artifact creation; OpenNext warns about Windows support limits. Do not run concurrent Next/OpenNext builds against the same .next directory.

Set the final web domain to `https://app.<domain>`, provision its Cloudflare custom domain/DNS/TLS, and use `https://api.<same-domain>` for API. Update API `WEB_ORIGIN` to the exact final web origin and rebuild the Worker with the final API base. OAuth callback/return domains must align.

Only hashed `/_next/static/*` assets receive the configured public immutable cache header. Do **not** add Cache Everything to authenticated HTML or API responses. Current authenticated pages are shells with browser-authenticated API reads; credentials/private data must not enter shared caches. The app does not currently use ISR/revalidation; add appropriate R2 incremental cache configuration before introducing it. No fake social images or catch-all public cache are configured.

## 10. Jira production OAuth

Canonical configuration:

```text
API_PUBLIC_URL=https://api.<domain>
WEB_ORIGIN=https://app.<domain>
ATLASSIAN_REDIRECT_URI=https://api.<domain>/api/v1/integrations/jira/oauth/callback
Browser return=https://app.<domain>/onboarding/integration?provider=jira
NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1
```

Register the **exact** callback in Atlassian Developer Console Authorization settings; inject the matching client ID/secret and a stable `ATLASSIAN_TOKEN_ENCRYPTION_KEY`. Configure actual Jira site/project access and app distribution if users outside the developer account need authorization. Current scopes: `read:jira-work`, `write:jira-work`, `read:jira-user` and `offline_access`. Check upstream app consent and necessary Jira project permissions.

The API constructs the browser return from `WEB_ORIGIN`; no production localhost literal is used. Startup validates HTTPS production origins and exact callback-to-API correspondence. Do not introduce a second differently named callback variable. Refresh tokens and encrypted credentials persist in PostgreSQL; rotating the encryption key without migration breaks existing connections.

## 11. Auth, cookies, CORS and proxies

Access JWTs use the configured signing secret/lifetime. Refresh tokens are persisted in PostgreSQL and supplied as `lumos_refresh_token` cookies: **HttpOnly**, **Secure** in production or when API_PUBLIC_URL is HTTPS, **SameSite=Lax**, host-only API domain, path **/api/v1/auth**, max-age from `AUTH_REFRESH_TTL_DAYS`. Clearing uses matching cookie flags/path. There is no current cookie-domain environment override.

Separate **same-site subdomains** (`app.example.com` and `api.example.com`, both HTTPS) work with host-only API cookies and credentialed browser fetches. Temporary `workers.dev` and `northflank.app` origins are cross-site: Lax refresh cookies will not accompany ordinary cross-site requests. Prefer final same-site custom domains; do not silently switch to SameSite=None or widen cookie Domain to hide this issue.

API CORS uses the exact normalized `WEB_ORIGIN` with credentials and GET/POST/PUT/PATCH/DELETE/OPTIONS; client API transport includes credentials. `WEB_ORIGIN` is an origin, not a URL with paths, queries or embedded credentials. Configure TLS on both endpoints and test refresh/login across actual deployed origins.

Fastify trust proxy is disabled unless `TRUSTED_PROXY_CIDRS` explicitly contains valid IPs/CIDRs. Arbitrary wildcard/boolean/hop-count trust is rejected. Northflank ingress must sanitize/overwrite incoming forwarded headers and be the only public path to the API. Confirm the **immediate trusted proxy** ranges from provider/account configuration before enabling it; do not simply trust Cloudflare or every private address. Incorrect broad trust lets attackers spoof client IPs and bypass IP rate limits; trust-none behind ingress can concentrate legitimate clients under one proxy IP. Validate both behavior and rate-limit attribution in staging.

Platform admin tokens have a separate audience/role path; protect the bootstrap account and remove initial bootstrap secrets after provisioning. Production email must use Resend with a verified plain sender address; console delivery logs OTPs and is rejected.

## 12. Exact deployment order (not executed by this task)

1. **Supabase:** Frankfurt project, Session Pooler, verified TLS/CA, backup and connection budget.
2. **Upstash:** Frankfurt native TLS endpoint, persistence/quotas; authorized compatibility check.
3. **LiveKit/provider credentials:** same LK project for API/Go; AssemblyAI, Groq, Edge availability, Atlassian app and verified Resend sender.
4. **Northflank API:** create/build `lumos-api` in the single London project, attach env/secrets/domain/health configuration. On the first release **keep it paused/no user traffic** until the next step; API workers expect migrated tables during bootstrap.
5. **Migrations:** run the compiled API-image CLI once using Supabase URL/CA; inspect all 13 ledger entries. Then enable/start API and confirm live/ready before continuing.
6. **Northflank realtime:** create/build/start `lumos-realtime` with private port/metrics credentials, continuous execution and shutdown policy.
7. **Cloudflare web:** build with final API base, publish only when approved, attach the final same-site web custom domain/TLS and verify cache rules.
8. **Jira callback finalization:** update registered callback and corresponding API env to final API/web domains; confirm browser OAuth return.
9. **Staging smoke:** run every checklist below against isolated staging workspace/data/Jira project and test controlled restart recovery.
10. **Production release:** after approval and quota/security review, promote known image/Worker versions and monitor metrics, outbox/pending state and provider usage.

Do not launch API normal workers against an empty database just because the service is created before the migration step. Disable automatic promotion until the migration gate succeeds. Do not run migrations from each replica or during every process restart.

## 13. Post-deploy smoke tests

Replace example domains with configured domains. Use local/private metrics access or a private monitoring job, not a new public metrics endpoint. Never paste secrets into a public transcript or command history.

```powershell
$lumosApiBase = 'https://api.example.com/api/v1'
Invoke-RestMethod "$lumosApiBase/health/live"
Invoke-RestMethod "$lumosApiBase/health/ready"
# Check credentialed CORS preflight response: exact web origin, credentials allowed.
Invoke-WebRequest "$lumosApiBase/auth/refresh" -Method Options -Headers @{
  Origin = 'https://app.example.com'
  'Access-Control-Request-Method' = 'POST'
}
```

- [ ] API live 200 and ready 200; PostgreSQL/Redis dependency status is up. An intentionally unavailable dependency should fail readiness, not report healthy.
- [ ] Signup, email verification/Resend delivery, login, refresh and logout work on final same-site domains. Cookie flags and clear behavior match policy.
- [ ] Workspace/workflow/onboarding completes and real role/usage controls apply.
- [ ] Jira OAuth opens the configured app, returns to the exact API callback then web onboarding route, connects a real project and persists encrypted credentials.
- [ ] Demo start creates one real meeting; browser user + Alex/Maya + Lumos connect to the correct LiveKit room.
- [ ] User microphone and demo WAVs publish audio; AssemblyAI emits final speaker-associated transcripts.
- [ ] Evidence/semantic streams progress; Groq produces grounded commitments rather than only frontend animations.
- [ ] Maya's two related final-review/check statements form **one lineage** and create **one SprintItem**. Record its ID and eventual mapped Jira key.
- [ ] Missing due date opens one unresolved gap; Lumos waits for the 500ms floor quiet window and speaks a real clarification.
- [ ] Another participant can answer `On Monday.` or another supported deadline, including after a normal intervening sentence.
- [ ] Refinement has `supersedesObservationId`; owner stays Maya and due text/date becomes present.
- [ ] PostgreSQL `sprint_items.due_at` is non-null on the **same item ID**; Jira due date is updated on the **same issue key**, with no second issue mapping.
- [ ] Missing-due gap is resolved; stale queued questions are not spoken; Commitment and Execution cards both show due date.
- [ ] Human barge-in stops TTS/queued audio; unresolved gaps retry promptly after quiet, resolved gaps do not. New demo WAVs never start over active Lumos speech.
- [ ] Dashboard/activity/sprint/meetings reflect real persisted records and workspace boundaries.
- [ ] Ending the meeting stops transcription/TTS/demo rooms with one cleanup path; lease/runtime state recovers after a deliberate staging restart.
- [ ] Deleted meeting detail returns API 404 and browser redirects to `/app/meetings`; 500/network errors retain error/Retry UI.
- [ ] Root Redis compatibility smoke passes against the **authorized** native TLS staging instance, including Streams, Lua and pending recovery. Do not run destructive DB/Redis resets.
- [ ] Metrics missing/invalid bearer credentials return 401; valid credentials return metrics; port is not publicly reachable. If using only private-only/no-token mode, verify an external connection cannot reach it.
- [ ] Browser title is page name + Lumos AI, real Lumos SVG tab icon loads, smooth-scroll warning is absent, no demo cleanup state-mismatch warning caused by our lifecycle.
- [ ] Observe provider quotas, Go CPU/memory, Redis commands/pending/lag, API errors and Jira outbox retry state through an entire meeting.

Private metrics auth example (token injected into environment/secret store, never hardcoded):

```powershell
$lumosMetricsUrl = 'http://<private-realtime-host>:8081/metrics'
# Unauthenticated probe: expect HTTP 401 when a token is configured.
# Valid probe:
Invoke-WebRequest $lumosMetricsUrl -Headers @{
  Authorization = 'Bearer ' + $env:METRICS_BEARER_TOKEN
}
```

## 14. Rollback

Record Git revision, both immutable image digests, Worker version, migration ledger, stable auth/encryption secrets and pre-release backup before promotion. Stop new meetings/drain current work before a schema-incompatible rollback. Restore the previous compatible API/realtime images and Worker version; retain PostgreSQL and Redis state/mappings rather than clearing them.

Image rollback is safer than automatic migration reversal. `migration:revert` reverts **one last migration** and can drop data. Use only after checking deployed code compatibility, reviewing its `down` implementation and securing a restorable backup. Prefer a forward corrective migration for existing production data. If restoring PostgreSQL, reconcile Jira mappings/outbox and semantic execution cursors: external Jira side effects do not roll back with a DB snapshot.

Do not rotate JWT/OTP/Atlassian encryption secrets as an accidental side effect of redeploying; intentional rotation needs a session/token/data migration plan. Restarted Go must obtain current fenced leases before operating. A Redis flush removes replay and idempotency state, not merely cache.

## 15. Free-tier limits and remaining risks

- Northflank's free Sandbox is intended for exploration, not production assurance. Two service slots leave little headroom for extra continuous workers. London-to-Frankfurt cross-region dependencies add network latency; measure real meetings before scaling.
- Supabase free project suspension, connection/storage limits, backups/PITR and restore access require plan review. Session pooling does not remove backend connection limits.
- Upstash command/connection/storage limits and throttling can affect streams/leases; API polling and metrics are cost-sensitive. Define durable retention and alert before exhaustion; upgrade before relying on free-tier availability.
- Cloudflare Worker CPU/request/asset quotas and OpenNext runtime behavior require local preview plus hosted staging checks. Static build success is not a deployed browser demo.
- LiveKit audio/room/egress minutes, AssemblyAI streaming concurrency/minutes, Groq model/token quotas, Jira rate limits and Resend sending/domain quotas need explicit budgets.
- Edge TTS relies on a library-backed external service without a documented contracted SLA in this repo. Outages/voice changes are a release risk, not an environment variable fix.
- SameSite=Lax needs final same-site domains. Trusted proxy CIDRs, TLS CA requirements, region entitlements and external OAuth app distribution must be supplied/verified by the operator.
- Redis stream archival/deletion and log/PII retention are not a complete implemented compliance policy. Backups must include lineage/mappings/outbox and stable encryption keys.
- Production dependency audit and container builds are not container OS-CVE scans. Development-tool advisories, base-image audit and hosted penetration/abuse checks remain separately reviewable.
- Live external-provider E2E, hosted Supabase SSL, Upstash compatibility and load/restart testing are **not claimed** merely because local tests pass.

## 16. Release verification record

Read-only documentation guard from root: `npm run check:docs` (`scripts/check-deployment-docs.mjs`). It verifies all service config variables are documented, all 13 migration filenames/classes are listed, required docs/links/deployment paths exist, pinned web versions match and the real icon asset remains unchanged.

Record actual command results here only after they are executed. Required pre-push checks: web typecheck/tests/Next/OpenNext build; API tests/build/production dependency audit; all Go tests/race/native compile; 13 clean migrations; both Linux image builds; local Redis compatibility; rendered metadata/icon checks; docs env/path audit; secret/index scan; both working and staged whitespace checks.

GitHub push readiness is distinct from approval to deploy. No commit, push or deployment is performed by this preparation task.

### Verification performed on 2026-09-30

| Check | Actual result |
| --- | --- |
| Web `npm run typecheck` | PASS |
| Web `npm test` | PASS: 45 tests / 5 files |
| Web `npm run build` | PASS: Next 16.3.6, including `/icon.svg` and dynamic meeting route |
| Web `npm run build:cloudflare` | PASS: OpenNext Worker generated; Windows support warning remains advisory |
| Local `npm run preview:cloudflare -- --port 3008` | PASS HTTP 200 for landing/login/demo/dynamic meeting/icon; preview stopped afterward |
| Rendered metadata/icon | PASS: 13 prerendered route titles plus dynamic Meeting title in Worker preview; real SVG served as image/svg+xml, no default favicon link |
| API `npm test` | PASS: 173 tests / 33 files with disposable migrated PostgreSQL and local Redis; external Jira stubbed |
| API `npm run build` | PASS locally and in Linux Docker build |
| API production `npm audit --omit=dev` | PASS: 0 vulnerabilities |
| Full root `npm audit` | **Exit 1**: 5 development-tool advisories (2 low / 1 moderate / 2 high), all under `@nestjs/mau` via inquirer/external-editor/tmp and undici. No blind force upgrade applied |
| Go `gofmt` on modified Go files | Applied |
| Go `go test ./...` | PASS with local Redis configured |
| Go relevant `go test -race` | PASS: config, observability, redisclient, meetingactor, semantics, groqsemantic, intervention, meetingruntime, speechfloor, livekitclient |
| Go `go build ./cmd/realtime` | PASS with Windows UCRT64 CGO toolchain; no undefined ProtectMetrics |
| Clean PostgreSQL migration run | PASS: all 13 ordered migrations on disposable PostgreSQL 17; compiled image CLI showed all 13 applied |
| API Linux image | PASS: `lumos-api:production-check`, non-root node, production dependencies; health/ready, native Argon2, SIGTERM exit 0 |
| Realtime Linux image | PASS: `lumos-realtime:production-check`, non-root lumos; Opus/opusfile/soxr and transitive shared libraries resolved by ldd |
| Local Redis compatibility | PASS: native streams/group/recovery/Lua/expiry/pipeline/transaction suite; no production Upstash touched |
| `npm run check:docs` | PASS: 8 docs, complete service env coverage, paths, versions, 13 migrations/classes and unchanged logo |
| Secret scan | No detected credential patterns in 500 working-tree push candidates and 451 index blobs at scan time; real local .env remains ignored |
| Working/index whitespace | `git diff --check` and `git diff --cached --check` PASS at verification time; .gitignore line-ending normalization warning is not a whitespace failure |

Image IDs built from this code:

- API: `sha256:127bd4250eaf9958e729208d4bd75c5c17b0ca8369b966d3fad8e215fe5033fc`.
- Realtime: `sha256:95135a52ab3839a2ed36904ae76a41f75e4f58df8d0dfd09f6c7b89ad79e9325`.

The initial additional internal-handler identity test had an invalid comparison of Go function values; it was corrected to a comparable mux wrapper and the full/race suites passed afterward. The first ad-hoc native Argon2 check failed from PowerShell argument quoting; the corrected check passed. Sandbox-only compiler/Docker access failures were rerun with the necessary permissions. These are not concealed successful commands.

No hosted Supabase/Upstash/LiveKit/Groq/AssemblyAI/Jira/Resend smoke run or OS container-CVE scan is claimed. Local preview HTTP checks do not constitute a microphone/browser provider E2E. Only this task's disposable containers/anonymous fixture volumes were removed; existing local PostgreSQL/Redis and running realtime were preserved.

## 17. Pre-push scope and artifact classification

This task changes configuration, metadata, tests and permanent docs; semantic/Jira/floor business logic is untouched. Existing staged app/worker deletions and unrelated source changes were preserved.

**A — deleted disposable artifacts:** tracked generated `apps/api/tsconfig.build.tsbuildinfo` (also removed from index), and unreferenced old `services/realtime-go/tmp/realtime-a.log`, `realtime-a.err.log`, `realtime-b.log`, `realtime-b.err.log`. These logs were September 19 one-off debug output with no code/doc references; they are not runtime state. Cache can be regenerated by building; old debug logs are not retained by this cleanup.

**B — retained/normalized permanent material:** all six required repository docs, API/web READMEs (starter content replaced with service-specific pointers), regression tests, migrations, production helpers, Dockerfiles, OpenNext configuration and real demo/logo assets. No required docs were deleted.

**C — left untouched / do not push:** current `services/realtime-go/realtime.log`, existing runtime binaries and user-local environments; provenance/current use is not assumed disposable. They are ignored. Installed dependencies and regenerated Next/OpenNext/TypeScript output remain local/ignored; build verification is not a reason to commit them.

The initial index contained **109 zero-byte staged placeholders**, while implementations existed in the working tree; new production helpers/docs were also untracked. That partial index was unsafe. Staging has now been refreshed from the verified, secret-scanned working tree, preserving all existing source/deletion content. The final index has **500 tracked paths**, **0 empty source/doc files**, **0 forbidden environment/build/log/key artifacts** and **0 detected secret patterns**. Metrics and other new helpers/docs are included. The release changes comprise **322 staged paths** (168 additions, 127 modifications, 23 deletions, 4 renames); these counts include pre-existing user work, not just this task. No unstaged or untracked release files remain. No commit or push was performed.

Required paths created in this task: `README.md`, `docs/production-deployment.md`, `docs/local-development.md`, `docs/architecture.md`, `docs/demo-flow.md`, `docs/security-production-checklist.md`, `apps/web/src/app/icon.svg`, `services/realtime-go/.env.example` and `scripts/check-deployment-docs.mjs`.

No new application-runtime env names were introduced; all current names are documented in section 4.

### Exact working-tree files edited/created by this task

This inventory is relative to the tree inspected at the start of this task, not every pre-existing change versus Git HEAD. Existing untracked production files edited here may now appear as Git additions.

Existing files edited (32):

- `.env.example`
- `.gitignore`
- `package-lock.json`
- `apps/api/Dockerfile`
- `services/realtime-go/internal/observability/auth.go`
- `services/realtime-go/internal/observability/auth_test.go`
- `services/realtime-go/internal/config/production_test.go`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/layout.spec.tsx`
- `apps/web/src/app/(auth)/forgot-password/page.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/reset-password/page.tsx`
- `apps/web/src/app/(auth)/signup/page.tsx`
- `apps/web/src/app/(auth)/verify-email/page.tsx`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/integrations/page.tsx`
- `apps/web/src/app/admin/login/page.tsx`
- `apps/web/src/app/admin/system/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/workspaces/page.tsx`
- `apps/web/src/app/app/activity/page.tsx`
- `apps/web/src/app/app/dashboard/page.tsx`
- `apps/web/src/app/app/demo/page.tsx`
- `apps/web/src/app/app/integrations/page.tsx`
- `apps/web/src/app/app/meetings/page.tsx`
- `apps/web/src/app/app/meetings/[meetingId]/page.tsx`
- `apps/web/src/app/app/settings/page.tsx`
- `apps/web/src/app/app/sprint/page.tsx`
- `apps/web/src/app/onboarding/layout.tsx`
- `apps/api/README.md`
- `apps/web/README.md`
- `package.json`

Files created (9):

- `README.md`
- `docs/production-deployment.md`
- `docs/local-development.md`
- `docs/architecture.md`
- `docs/demo-flow.md`
- `docs/security-production-checklist.md`
- `apps/web/src/app/icon.svg`
- `services/realtime-go/.env.example`
- `scripts/check-deployment-docs.mjs`
