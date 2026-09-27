import fs from "fs";
import path from "path";

// Vitest doesn't load .env the way Next.js does, so read it in manually.
// Real environment variables win over file values.
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

const DB_URL_KEYS = ["POSTGRES_PRISMA_URL", "supabase_POSTGRES_URL_NON_POOLING"] as const;

for (const key of DB_URL_KEYS) {
  if (!process.env[key]) {
    throw new Error(
      `${key} is not set. Tests need POSTGRES_PRISMA_URL and supabase_POSTGRES_URL_NON_POOLING — put them ` +
        "in .env, then run `npx prisma db push` once so the test schema exists."
    );
  }
}

// Tests run in their own Postgres schema. resetDb() truncates every table
// between tests, so pointing them at the default `public` schema would delete
// real campaign data on every run.
for (const key of DB_URL_KEYS) {
  const url = new URL(process.env[key]!);
  url.searchParams.set("schema", "test");
  process.env[key] = url.toString();
}

process.env.WEBHOOK_SECRET = "test_webhook_secret";
process.env.DEMO_MODE = "false"; // tests drive the webhook flow manually
