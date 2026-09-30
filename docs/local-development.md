# Local development (Windows / PowerShell)

## Toolchain and install

Use Node 22.22.3, npm >=10, Go 1.27.0 and Docker Desktop in Linux-container mode. This is an npm workspace monorepo; do not maintain separate service lockfiles. At the repository root:

```powershell
node --version
npm.cmd --version
go version
docker version
npm.cmd ci
Copy-Item .env.example .env
```

`npm.cmd install` from the root is appropriate when deliberately changing dependencies. Use `npm.cmd`/`npx.cmd` if PowerShell policy blocks `npm.ps1`. Keep `package-lock.json` with any manifest change.

Fill the ignored root `.env`; never paste real values into docs. Required API and Go variables are exhaustively listed in [production deployment](production-deployment.md). Local examples:

```dotenv
NODE_ENV=development
POSTGRES_USER=lumos
POSTGRES_PASSWORD=<local-only-password>
POSTGRES_DB=lumos
DATABASE_URL=postgresql://lumos:<url-encoded-local-password>@127.0.0.1:5432/lumos
DATABASE_SSL_MODE=disable
REDIS_URL=redis://127.0.0.1:6379
WEB_ORIGIN=http://localhost:3000
API_PUBLIC_URL=http://localhost:3001
ATLASSIAN_REDIRECT_URI=http://localhost:3001/api/v1/integrations/jira/oauth/callback
AUTH_EMAIL_PROVIDER=console
LIVEKIT_BOT_IDENTITY=lumos
LIVEKIT_URL=wss://<project>.livekit.cloud
```

Generate independent JWT/OTP secrets of at least 32 characters and a base64-encoded 32-byte Atlassian encryption key. Fill LiveKit, AssemblyAI, Groq and Atlassian credentials from your own accounts. Console email is **development only** and logs OTPs; use test accounts and protect logs. Omit optional bootstrap fields rather than assigning empty strings that fail schema validation.

API reads root `../../.env` and service `.env`. Go loads service `.env` if present, otherwise root `../../.env`; existing process environment wins. Next runs in `apps/web` and needs its own ignored `.env.local` or explicit shell variables. Do not assume Next reads the root `.env`.

## Local PostgreSQL / Redis

```powershell
docker compose up -d postgres redis
docker compose ps
docker exec lumos-redis redis-cli ping
```

The compose containers are `lumos-postgres` (PostgreSQL 17, loopback 5432) and `lumos-redis` (Redis 7, loopback 6379, AOF enabled). Named volumes retain data across restarts. Changing `POSTGRES_PASSWORD` does not change the password inside an existing initialized volume. Do not remove volumes to troubleshoot a shared database.

Inspect PostgreSQL health with `docker compose ps` or `docker compose exec postgres pg_isready` (specify the configured user/database if necessary).

## API terminal

```powershell
cd apps/api
npm.cmd run migration:run
npm.cmd run migration:show
npm.cmd run start:dev
```

API listens on `API_PORT`, default 3001. Health endpoints:

```powershell
Invoke-RestMethod http://localhost:3001/api/v1/health/live
Invoke-RestMethod http://localhost:3001/api/v1/health/ready
```

Readiness checks PostgreSQL and Redis, not all external providers. No `synchronize=true`. There are 13 ordered migrations. `npm.cmd run migration:revert` reverts one migration and can remove data: use only on disposable local data or with a reviewed rollback plan.

## Web terminal

```powershell
cd apps/web
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1'
npm.cmd run dev
```

Open `http://localhost:3000`. For a different port use `npm.cmd run dev -- --port 3002` and update API `WEB_ORIGIN` accordingly. `WEB_PORT` in the root example is only a convenience, not a Next configuration variable. Use `PORT` or `--port`. Do not expose provider keys through public variables.

## Realtime terminal: native audio requirements

Install MSYS2 and, in its **UCRT64 shell**, install:

```sh
pacman -S --needed mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-pkgconf mingw-w64-ucrt-x86_64-opus mingw-w64-ucrt-x86_64-opusfile mingw-w64-ucrt-x86_64-soxr
```

Then use PowerShell:

```powershell
cd services/realtime-go
$env:PATH = 'C:\msys64\ucrt64\bin;' + $env:PATH
$env:CGO_ENABLED = '1'
$env:CC = 'C:/msys64/ucrt64/bin/gcc.exe'
$env:PKG_CONFIG = 'C:/msys64/ucrt64/bin/pkg-config.exe'
$env:PKG_CONFIG_PATH = 'C:/msys64/ucrt64/lib/pkgconfig'
go test ./...
go run ./cmd/realtime
```

LiveKit audio decode/encode uses native Opus/opusfile; resampling uses soxr. These modules require CGO, compiler headers at build time and matching DLLs at runtime. Mixing MSYS, MINGW64 and UCRT64 toolchains can cause link failures. Linux deployment uses the dedicated Dockerfile with native Debian libraries, not MSYS paths.

Metrics listen on `REALTIME_PORT=8081`. Unauthenticated local metrics are allowed in development. If `METRICS_BEARER_TOKEN` is set, send a bearer header even on localhost. Do not set `NODE_ENV=production` with insecure local Redis; production transport and metrics safeguards intentionally reject that configuration.

## Tests and isolated integration data

```powershell
# root; local Redis only
$env:REDIS_URL = 'redis://127.0.0.1:6379'
npm.cmd run smoke:redis
```

API tests include PostgreSQL integration tests. Override `DATABASE_URL` to a disposable migrated database before `npm.cmd test`. Go Redis integration tests run when local Redis is reachable; provide `REDIS_URL` explicitly to avoid silently skipping required persistence checks. Tests use isolated meeting IDs; do not run them against Upstash production.

## Troubleshooting

- **gcc not found / missing pkg-config / missing DLL:** confirm `C:\msys64\ucrt64\bin` is first in PATH, `CC` points to UCRT64 gcc, and the native libraries above are installed. Reopen terminals after toolchain changes.
- **8081 already in use:** inspect `Get-NetTCPConnection -LocalPort 8081` and its owning process. Stop only a process you own or use another `REALTIME_PORT`. Do not start two lease owners accidentally while debugging.
- **3000/3001 conflicts:** inspect `Get-NetTCPConnection -LocalPort 3000,3001`. Change Next `--port` or `API_PORT`, then update `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` together.
- **PostgreSQL / Redis readiness fails:** check compose health, matching credentials, ports and migrations. The API must use local plaintext DB/Redis URLs only outside production.
- **LiveKit startup or room join fails:** API and Go must use the same Cloud project, `wss://` URL, API key and secret. Bot identity must not collide with human/demo identities.
- **No microphone/transcription:** allow browser microphone permission; use localhost or HTTPS, select the correct input and check LiveKit audio publication. AssemblyAI credentials/quota and outbound WebSocket access are also required.
- **No spoken clarification:** check realtime logs without copying tokens/transcripts publicly; ensure the floor becomes quiet and the gap remains unresolved. A resolved gap intentionally produces no stale question.
- **Slow first route in dev:** Next/Turbopack first compilation can dominate request timing. An observed 15.7s request reported ~15.6s Next overhead and ~73ms application work; that evidence points to dev compilation, not a proven runtime bottleneck.
- **Production build needs network:** `next/font/google` fetches Geist at build time. Cloudflare builds require the HTTPS `NEXT_PUBLIC_API_URL` at build time.
