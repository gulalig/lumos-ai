# Production security checklist

This is a release gate, not a claim that hosted configuration has already been verified. Use the environment reference and operational steps in [production deployment](production-deployment.md).

## Repository and credentials

- [ ] No tracked/staged `.env`, provider keys, passwords, JWT/OTP secrets, access/refresh tokens, private keys, database URLs with real credentials, transcripts, logs or build outputs.
- [ ] `.env.example` values are blanks/placeholders or non-secret local defaults. Root/service `.env` and Next `.env.local` are ignored.
- [ ] Review `git diff`, `git diff --cached`, untracked files and `git diff --check`. New production helpers/configs must be included in the eventual commit; a partial staged tree can omit critical source.
- [ ] Use service-specific secret groups; Cloudflare browser config gets only public API URLs, not API/Go provider secrets.
- [ ] Rotate any exposed credential immediately. Do not merely delete it from the current file and assume Git history or external logs are safe.

## Authentication and browser boundaries

- [ ] Independent high-entropy `JWT_ACCESS_SECRET` and `AUTH_OTP_PEPPER`, each >=32 characters; stable secrets across API replicas/restarts.
- [ ] `JWT_ACCESS_EXPIRES_IN` and `AUTH_REFRESH_TTL_DAYS` are reviewed. Refresh sessions persist in PostgreSQL; expiry/revocation must be tested.
- [ ] Refresh cookie is HttpOnly, Secure in production/HTTPS, SameSite=Lax, host-only for the API and path `/api/v1/auth`; clearing uses matching settings.
- [ ] Web and API use HTTPS subdomains of the **same registrable domain**. Separate `workers.dev`/Northflank domains are cross-site and do not satisfy the existing Lax refresh-cookie flow.
- [ ] API CORS allows exactly `WEB_ORIGIN` with credentials, not wildcard `*`; client requests include credentials.
- [ ] Access JWTs are browser-held application state; do not store them in public logs/URLs. HttpOnly refresh protection does not remove the need to prevent XSS.
- [ ] OAuth return URLs are configured, exact and HTTPS. OAuth state is validated; no production localhost callback.
- [ ] Administrative authentication is separately scoped. Bootstrap uses a unique password >=12 characters; remove bootstrap credentials after initial provisioning. Limit admin access operationally.

## Proxy and network

- [ ] `TRUSTED_PROXY_CIDRS` contains only verified immediate Northflank ingress proxies or trusted proxy networks. Empty means no forwarded-header trust.
- [ ] Never trust arbitrary `X-Forwarded-For`, wildcard proxies or hop counts. Ingress must overwrite/sanitize forwarded headers and prevent direct public access bypass.
- [ ] Validate client IP attribution and rate-limit behavior through the actual Northflank ingress. Defaulting to trust-none is safer than inventing CIDRs, but can aggregate clients under one proxy IP.
- [ ] API public ingress is TLS; runtime metrics port is internal/private. The Go service is a continuous worker, not a public HTTP application.

## Metrics

- [ ] Production sets `NODE_ENV=production` and either a strong `METRICS_BEARER_TOKEN` or explicitly `METRICS_PRIVATE_ONLY=true` with enforced private networking. Prefer both token and private networking.
- [ ] `METRICS_PRIVATE_ONLY` is an operator assertion, **not** a firewall or source-IP filter. Port 8081 listens on all container interfaces and must not receive public ingress.
- [ ] Missing/invalid bearer auth returns 401, valid auth reaches metrics, and credentials never appear in responses/logs.
- [ ] Monitoring uses a protected secret header. If using HTTP metrics probes, configure the header; otherwise use a private TCP probe. No invented Go `/health` endpoint.

## Data transport, retention and recovery

- [ ] Supabase Session Pooler URL is injected as a secret; verify-full TLS is used, with the provider CA mounted if required. Do not disable certificate verification.
- [ ] Migrations run once as a release operation, with backup and a reviewed rollback procedure. No `synchronize=true`.
- [ ] Upstash URL is native `rediss://`, not REST; certificates are verified. Run the isolated compatibility smoke before enabling live meetings.
- [ ] Redis is durable pipeline state, not disposable cache. Preserve streams/checkpoints/leases/delivery and cursor state; never `FLUSHALL`/`FLUSHDB` to retry production.
- [ ] Define transcript/evidence retention, deletion, access and backup policies. Individual TTLs do not ensure all streams are retained or purged appropriately.
- [ ] Backup PostgreSQL mappings/outbox/execution links and stable encryption keys together. Exercise restore into staging.
- [ ] Treat meeting audio/transcripts, email addresses and commitments as personal/business data. Provider processing regions/consent and lawful retention require operator review.

## Providers, costs and logs

- [ ] LiveKit keys exist only server-side; tokens are room/identity scoped. Monitor room minutes, participants and outbound traffic.
- [ ] AssemblyAI and Groq quotas/billing limits are set; streaming concurrency and model request limits are monitored.
- [ ] Edge TTS availability and unofficial service/library risk are accepted; no false claim of contracted SLA or guaranteed quota.
- [ ] Atlassian OAuth scopes and app distribution permissions match actual Jira use; encrypt tokens with a stable base64 32-byte key and protect refresh rotation.
- [ ] Resend verified sender/domain and quotas are configured. `AUTH_EMAIL_PROVIDER=console` is prohibited in production because it logs OTPs.
- [ ] Rate-limit and workspace usage policies are reviewed; free-tier limits are not a substitute for abuse controls.
- [ ] Logs exclude credentials and avoid unnecessary transcript content; restrict access and retention. Existing errors/provider diagnostics may contain PII: review hosted output before sharing.

## Supply chain and deployment

- [ ] Lockfile is committed and consistent with workspace manifests; use `npm ci`.
- [ ] Production dependency audit passes. Review development-tool advisories separately; do not run blind `npm audit fix --force` upgrades.
- [ ] Both Linux images build; API uses non-root Node with production dependencies, Go uses non-root runtime and all shared libraries resolve.
- [ ] Scan images with the chosen registry/image scanner before production; local build success is not a CVE scan.
- [ ] `.dockerignore` excludes environment files, certificates/keys, Git metadata, logs, binaries and caches.
- [ ] Builds need network for npm/Go/native packages and web fonts. Do not place secrets in Docker ARG/layers.
- [ ] CI/deployment tokens have minimum permissions and are stored in provider secret stores.
- [ ] Graceful SIGTERM/restart recovery is tested. Monitor memory/CPU/Redis command budget before accepting free-tier production risk.
- [ ] Hosted smoke tests, domain/TLS, OAuth, database CA and Upstash compatibility are signed off before release.
