#!/usr/bin/env node
/**
 * Local development database: a real PostgreSQL 17 server whose data lives in
 * .localdb/devdata (git-ignored). Never used by tests (they get a throwaway
 * cluster, see with-test-postgres.mjs) and never connected to Supabase.
 *
 * Setup once:  npm --prefix .localdb install embedded-postgres@17.10.0-beta.17
 * Run:         npm run db:local        (Ctrl+C to stop)
 *
 * Point .env at it:
 *   supabase_POSTGRES_PRISMA_URL="postgresql://postgres:postgres@127.0.0.1:54329/internetwars"
 *   supabase_POSTGRES_URL_NON_POOLING="postgresql://postgres:postgres@127.0.0.1:54329/internetwars"
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const localdb = path.join(root, ".localdb");
const dataDir = path.join(localdb, "devdata");
const PORT = Number(process.env.DEV_PG_PORT ?? 54329);

const entry = path.join(localdb, "node_modules", "embedded-postgres", "dist", "index.js");
if (!existsSync(entry)) {
  console.error("embedded-postgres not found. Install it with:\n  npm --prefix .localdb install embedded-postgres@17.10.0-beta.17");
  process.exit(1);
}
const EmbeddedPostgres = (await import(pathToFileURL(entry).href)).default;

const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("internetwars");
console.log(`Local Postgres ready on 127.0.0.1:${PORT} (database "internetwars"). Ctrl+C to stop.`);

const stop = async () => {
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
