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

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Tests need a Postgres connection string — put one in .env, " +
      "then run `npx prisma db push` once so the test schema exists."
  );
}

// Tests run in their own Postgres schema. resetDb() truncates every table
// between tests, so pointing them at the default `public` schema would delete
// real campaign data on every run.
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("schema", "test");
process.env.DATABASE_URL = url.toString();

process.env.WEBHOOK_SECRET = "test_webhook_secret";
process.env.DEMO_MODE = "false"; // tests drive the webhook flow manually
