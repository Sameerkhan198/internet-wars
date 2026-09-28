#!/usr/bin/env node
/**
 * Build-time database migration step (replaces `prisma db push`).
 *
 * Rules:
 *  - Vercel PREVIEW builds never modify the database. Previews share the
 *    production database, so a feature branch must not be able to migrate it.
 *    They only report `prisma migrate status`.
 *  - A database that predates migration history (created by `db push`) is
 *    baselined ONLY if it matches migration 0_init exactly. The comparison is
 *    read-only; on any drift the build FAILS, the live deployment keeps
 *    serving, and the difference is printed for a human to review.
 *  - Otherwise: `prisma migrate deploy` — applies pending migrations only.
 *    Never `migrate reset`, never `db push --accept-data-loss`.
 *
 * Connection URLs come from the environment via prisma/schema.prisma; this
 * script never prints them.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(import.meta.dirname, "..");
const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined (local)

function prisma(args, { capture = false } = {}) {
  const r = spawnSync(["npx", "prisma", ...args].join(" "), {
    cwd: root,
    shell: true,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function fail(msg) {
  console.error(`\n[migrate] ✖ ${msg}\n`);
  process.exit(1);
}

if (vercelEnv && vercelEnv !== "production") {
  console.log(`[migrate] ${vercelEnv} build: database is shared with production — NOT migrating. Status only:`);
  prisma(["migrate", "status"]);
  process.exit(0);
}

const db = new PrismaClient();
let hasHistory;
let tableCount;
try {
  const [h] = await db.$queryRaw`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS "exists"`;
  const [t] = await db.$queryRaw`
    SELECT count(*)::int AS "n" FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
  hasHistory = h.exists;
  tableCount = t.n;
} catch (err) {
  fail(`could not inspect the database: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
} finally {
  await db.$disconnect();
}

if (!hasHistory && tableCount > 0) {
  console.log("[migrate] database has tables but no migration history — verifying it matches baseline 0_init…");
  const diff = prisma(
    [
      "migrate", "diff",
      "--from-schema-datasource", "prisma/schema.prisma",
      "--to-schema-datamodel", "prisma/baseline/schema.prisma",
      "--exit-code",
    ],
    { capture: true }
  );
  if (diff.code === 0) {
    console.log("[migrate] ✔ live schema matches 0_init exactly — recording baseline as applied.");
    if (prisma(["migrate", "resolve", "--applied", "0_init"]).code !== 0) fail("could not record baseline");
  } else {
    const detail = prisma(
      [
        "migrate", "diff",
        "--from-schema-datasource", "prisma/schema.prisma",
        "--to-schema-datamodel", "prisma/baseline/schema.prisma",
        "--script",
      ],
      { capture: true }
    ).out;
    console.error("[migrate] Changes needed to make the live DB match 0_init (NOT applied):\n" + detail);
    fail("schema drift between the live database and baseline 0_init. Nothing was changed. Review before deploying.");
  }
}

console.log("[migrate] applying pending migrations (if any)…");
if (prisma(["migrate", "deploy"]).code !== 0) fail("migrate deploy failed");
console.log("[migrate] ✔ database is up to date.");
