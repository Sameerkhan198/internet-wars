#!/usr/bin/env node
/**
 * Runs the test suite against a throwaway, real PostgreSQL server.
 *
 * Why: the ledger tests rely on real transaction/locking semantics. Embedded
 * shims (PGlite) time out on them, and tests must never touch the hosted
 * Supabase database.
 *
 * Lifecycle (deterministic):
 *   1. start a brand-new cluster in a temp dir on a fixed local port
 *   2. apply the schema (prisma migrate deploy, or db push when no migrations)
 *   3. run vitest with the connection env pointing ONLY at that cluster
 *   4. stop the server and delete the data dir — pass or fail
 *
 * Dependency: `embedded-postgres` (real PostgreSQL binaries shipped via npm),
 * installed OUTSIDE the app's dependencies so Vercel builds never download it:
 *
 *     npm --prefix .localdb install embedded-postgres@17.10.0-beta.17   (PostgreSQL 17.10)
 *
 * Usage: npm run test:pg [-- <extra vitest args>]
 */
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const localdb = path.join(root, ".localdb");
const PORT = Number(process.env.TEST_PG_PORT ?? 54400);

let EmbeddedPostgres;
try {
  // ESM-only package living in .localdb/node_modules — import it by path.
  const entry = path.join(localdb, "node_modules", "embedded-postgres", "dist", "index.js");
  EmbeddedPostgres = (await import(pathToFileURL(entry).href)).default;
} catch {
  console.error("embedded-postgres not found. Install it with:\n  npm --prefix .localdb install embedded-postgres@17.10.0-beta.17");
  process.exit(1);
}

const dataDir = mkdtempSync(path.join(tmpdir(), "iw-test-pg-"));
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: false,
  // UTF-8 like Supabase; the Windows default (WIN1252) cannot store "₹".
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

// schema=test matches src/test/setup.ts, which forces the same schema.
// TEST_PG_CONNECTION_LIMIT=1 reproduces serverless (one connection per
// function) — catches code that needs a 2nd connection inside a transaction.
const limit = process.env.TEST_PG_CONNECTION_LIMIT ? `&connection_limit=${Number(process.env.TEST_PG_CONNECTION_LIMIT)}` : "";
const url = `postgresql://postgres:postgres@127.0.0.1:${PORT}/iw_test?schema=test${limit}`;
// Only the test cluster is visible to child processes — any hosted URL from
// the parent environment is overwritten, never inherited.
const env = {
  ...process.env,
  supabase_POSTGRES_PRISMA_URL: url,
  supabase_POSTGRES_URL_NON_POOLING: url,
  NODE_ENV: "test",
};

function run(cmd, args) {
  // One command string (npx is a .cmd shim on Windows, which needs a shell).
  // Every argument here is a fixed literal or a vitest flag from our own CLI.
  const r = spawnSync([cmd, ...args].join(" "), { cwd: root, env, stdio: "inherit", shell: true });
  return r.status ?? 1;
}

let code = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("iw_test");

  const hasMigrations = existsSync(path.join(root, "prisma", "migrations"));
  const schemaCode = hasMigrations
    ? run("npx", ["prisma", "migrate", "deploy"])
    : run("npx", ["prisma", "db", "push", "--skip-generate"]);
  if (schemaCode !== 0) throw new Error("schema setup failed");

  code = run("npx", ["vitest", "run", "--pool=threads", ...process.argv.slice(2)]);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  code = 1;
} finally {
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
process.exit(code);
