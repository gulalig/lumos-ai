import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Read-only release guard: never loads .env, connects to providers or logs values.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const guide = read("docs/production-deployment.md");
const apiSection = guide.split("### apps/api")[1].split("### services/realtime-go")[0];
const goSection = guide.split("### services/realtime-go")[1].split("### Local infrastructure")[0];
const webSection = guide.split("### apps/web")[1].split("### apps/api")[0];
const apiNames = [...read("apps/api/src/config/env.ts").matchAll(/^\s{4}([A-Z][A-Z_0-9]+):/gm)]
  .map((match) => match[1]);
const goSource = read("services/realtime-go/internal/config/config.go");
const goNames = [...goSource.matchAll(/os\.Getenv\(\s*"([A-Z][A-Z_0-9]+)"\s*,?\s*\)/g)]
  .map((match) => match[1]);
goNames.push("TTS_TIMEOUT", "TTS_MAX_RETRIES");
for (const [section, names] of [[apiSection, apiNames], [goSection, goNames], [webSection, ["NODE_ENV", "NEXT_PUBLIC_API_URL"]]]) {
  for (const name of new Set(names)) {
    assert(section.includes("`" + name + "`"), "Missing service environment documentation: " + name);
  }
}
for (const name of goNames) {
  assert(new RegExp("^" + name + "=", "m").test(read("services/realtime-go/.env.example")),
    "Missing realtime template variable: " + name);
}

const files = [
  "README.md", "docs/production-deployment.md", "docs/local-development.md",
  "docs/architecture.md", "docs/demo-flow.md", "docs/security-production-checklist.md",
  "apps/api/README.md", "apps/web/README.md",
];
for (const file of files) {
  const content = read(file);
  assert(!/^\\?\+\s?#/m.test(content), "Accidental patch markers in " + file);
  for (const [, target] of content.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (target.startsWith("https://") || target.startsWith("http://") || target.startsWith("#")) continue;
    const path = resolve(root, dirname(file), target.split("#")[0]);
    assert(existsSync(path), "Broken documentation link in " + file + ": " + target);
  }
}
const migrationSource = "apps/api/src/database/migrations";
const { readdirSync } = await import("node:fs");
const migrations = readdirSync(resolve(root, migrationSource)).filter((name) => name.endsWith(".ts")).sort();
assert.equal(migrations.length, 13, "Review the migration inventory when adding a migration");
let priorTimestamp = 0;
for (const filename of migrations) {
  const timestamp = Number(filename.split("-")[0]);
  assert(timestamp > priorTimestamp, "Migration timestamps must be unique and ordered");
  priorTimestamp = timestamp;
  const source = read(migrationSource + "/" + filename);
  const className = source.match(/export class (\w+) implements MigrationInterface/)?.[1];
  assert(className?.endsWith(String(timestamp)), "Migration class timestamp mismatch: " + filename);
  assert(guide.includes(filename) && guide.includes(className), "Migration missing from handoff: " + filename);
}
for (const path of ["apps/api/Dockerfile", "services/realtime-go/Dockerfile", "apps/web/open-next.config.ts", "apps/web/wrangler.jsonc", "scripts/redis-compatibility-smoke.mjs"]) {
  assert(existsSync(resolve(root, path)) && guide.includes(path), "Deployment file missing or undocumented: " + path);
}
assert(!read("apps/api/Dockerfile").includes("COPY apps/worker"), "API image references deleted worker workspace");
const web = JSON.parse(read("apps/web/package.json"));
for (const version of [web.dependencies.next, web.dependencies["@opennextjs/cloudflare"], web.devDependencies.wrangler]) {
  assert(guide.includes(version), "Web tool version is stale in handoff: " + version);
}
assert.equal(read("apps/web/src/app/icon.svg").trim(), read("apps/web/public/lumos_logo.svg").trim(),
  "App icon must reuse the real logo without redesign");
console.log("PASS: 8 documentation files, service env coverage, 13 migrations, deployment paths/versions and real logo");
