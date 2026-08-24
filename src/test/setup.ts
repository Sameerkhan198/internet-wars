import path from "path";

// Absolute path avoids ambiguity about what a relative sqlite "file:" URL is
// resolved against (schema.prisma's directory vs. the test runner's cwd).
// __dirname is unreliable under Vite/Vitest's ESM transform, so anchor to
// process.cwd() instead (vitest is always run from the project root).
process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), "prisma/test.db")}`;
process.env.WEBHOOK_SECRET = "test_webhook_secret";
process.env.DEMO_MODE = "false"; // tests drive the webhook flow manually, not the auto-delivery timer
