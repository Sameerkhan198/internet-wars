# Internet Wars — Indian Stock Market vs Forex Market

A community competition platform. Users pick a side (Indian Stock Market or Forex Market) and make a
voluntary contribution to support it; the side with the highest verified qualifying support is shown as
the leader. This is **not** betting, investing, or a financial product — see [Product principles](#product-principles)
and the in-app disclaimer.

**Status: DEMO MODE only.** No real payment provider is wired up. Real-money contributions must not
be enabled until legal, tax, payment-provider, consumer-protection, privacy, and applicable contest/gaming
compliance review is complete for the Indian market. See `PHASE4_LAUNCH_READINESS.md` for launch state.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- **Styling:** Tailwind CSS v4, self-hosted IBM Plex Sans + JetBrains Mono (`@fontsource`, no Google fetch)
- **Database:** Postgres (Supabase in production) via Prisma 6, with versioned migrations
- **Live updates:** short-interval polling (works identically on a persistent server and on serverless)
- **Validation:** Zod
- **Tests:** Vitest against a real, throwaway PostgreSQL server (`npm run test:pg`)

## Getting started (local)

```bash
npm install
npm --prefix .localdb install embedded-postgres@17.10.0-beta.17   # local PostgreSQL 17, git-ignored
npm run db:local        # terminal 1: local Postgres on 127.0.0.1:54329 (Ctrl+C to stop)
```

In `.env` (git-ignored):

```bash
supabase_POSTGRES_PRISMA_URL="postgresql://postgres:postgres@127.0.0.1:54329/internetwars"
supabase_POSTGRES_URL_NON_POOLING="postgresql://postgres:postgres@127.0.0.1:54329/internetwars"
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
WEBHOOK_SECRET=<any local value>
INITIAL_ADMIN_EMAIL=<your local admin email>
ADMIN_PASSWORD=<local one-time setup secret>
```

```bash
npx prisma migrate deploy   # create the tables from prisma/migrations
npm run db:seed              # demo campaign, two sides, ~180 demo contributions
npm run dev
```

Admin: open `/admin/login`. With no admin account yet it shows a one-time **Create first admin** form —
enter `INITIAL_ADMIN_EMAIL`, the `ADMIN_PASSWORD` value as the setup secret, and a new password
(≥ 12 characters). After that it's a normal email + password sign-in.

## Environment variables

| Variable | Purpose |
|---|---|
| `supabase_POSTGRES_PRISMA_URL` | Prisma runtime datasource (pooled). Injected by the Supabase Vercel integration. |
| `supabase_POSTGRES_URL_NON_POOLING` | Prisma `directUrl` (direct) — used by migrations. Also injected by the integration. |
| `DEMO_MODE` | Must be `"true"` until a real payment provider is integrated. Enables in-process demo payment confirmation and (with other guards) the demo reset. |
| `NEXT_PUBLIC_DEMO_MODE` | Same flag for the client-side DEMO MODE banner. Keep in sync with `DEMO_MODE`. |
| `DEMO_PAYMENT_FAILURE_RATE` | Fraction (0–1) of demo payments that resolve as FAILED. Default 0.08. |
| `WEBHOOK_SECRET` | HMAC secret for webhook signatures. **Required in production** (fails closed if missing). |
| `INITIAL_ADMIN_EMAIL` | Email of the first admin. Only used while no admin account exists. |
| `ADMIN_PASSWORD` | One-time setup secret for creating the first admin (never stored). Unused once an admin exists. |
| `REAL_PAYMENTS_ENABLED` | Leave unset. When `"true"`, the destructive demo reset is disabled regardless of other settings. |
| `NEXT_PUBLIC_APP_URL` | Base URL used for metadata, sitemap and robots. |

## Scripts

```bash
npm run dev           # dev server
npm run build         # prisma generate → scripts/migrate-deploy.mjs → next build
npm run start         # run the production build
npm run lint          # eslint
npm run test:pg       # full test suite on a throwaway PostgreSQL 17 (recommended)
npm run test          # vitest against whatever DB .env points at (uses its `test` schema)
npm run db:local      # local dev PostgreSQL (data in .localdb/devdata)
npm run db:migrate    # prisma migrate dev — create a new migration during development
npm run db:seed       # reset + reseed demo data (local)
npm run db:studio     # Prisma Studio GUI
```

`TEST_PG_CONNECTION_LIMIT=1 npm run test:pg` runs the suite with a one-connection pool, the way a
serverless function runs — it catches code that needs a second connection inside a transaction.

## Architecture

```
src/
  app/            Routes (App Router) — pages + API route handlers
  components/     UI (terminal battle view, charts, modal, admin forms, …)
  server/         Server-only logic: scoring, contributions/webhooks, campaign lifecycle and admin,
                  admin auth, demo-mode guard, analytics report, rate limiting, API error guard
  lib/            Shared: Prisma client, money, side themes, IST helpers, analytics event schema,
                  payment provider abstraction
  proxy.ts        Next 16's renamed middleware — optimistic cookie pre-filter for /admin
prisma/
  schema.prisma   Data model
  migrations/     Versioned migrations (0_init = the schema production ran before migrations)
  baseline/       Frozen copy of the 0_init schema, used only for the one-time baseline check
scripts/
  migrate-deploy.mjs      Build-time migration step (see Deploying)
  with-test-postgres.mjs  Throwaway PostgreSQL for tests
  dev-postgres.mjs        Local dev PostgreSQL
```

### The scoring rule this whole app is built around

**The frontend never sets a score.** Totals are always recomputed server-side from `Contribution` rows
with `status = SUCCESS` (`src/server/scoring.ts`) — scoreboard, leaderboard, history and the battle chart
all use that rule. A contribution starts `PENDING` and becomes `SUCCESS` only after a signed webhook is
verified and applied: the `PENDING → final` transition is a single conditional update, so under
concurrent or repeated deliveries exactly one caller applies it and fires side effects
(`src/server/contributions.ts`). Tests (`src/server/*.test.ts`, real PostgreSQL) hold:

- `PENDING` and `FAILED` contributions never affect any total.
- The same webhook delivered twice, or ten times concurrently, credits once with one activity event.
- A webhook with an invalid signature is rejected and never touches the ledger.
- Amounts are validated server-side against the campaign's min/max.
- Anonymous supporters' typed names are never stored or published.
- Scoreboard, leaderboard and chart agree; a campaign finalizes exactly once.

### Payment provider abstraction

`src/lib/payments/provider.ts` defines the interface (`id`, `createPayment`, `verifyPayment`,
`handleWebhook`, `refundPayment`, `getPaymentStatus`). `demoProvider.ts` is the only implementation: in
demo mode the signed confirmation is verified and applied in-process through the same path a real
webhook takes (a deferred HTTP callback can't run on serverless). A real provider implements the same
interface; `getPaymentProvider()` is the only switch.

### Campaigns

Admins create and run battles at `/admin` → **New battle**: title, description, start/end (IST), min/max
support, and for each side a name, short name and colour/emblem (bull, bear, or a generic mark in blue,
amber, cyan or orange). Lifecycle: `DRAFT → SCHEDULED → LIVE ⇄ PAUSED → ENDED` (or `CANCELLED`). Only one
battle can be `LIVE`/`PAUSED` at a time; scheduled battles open automatically at their start time if
nothing else is active; live battles finalize automatically at their end time. Editing a running battle
is limited to presentation and the end time; closed battles are read-only. Contribution rows are never
modified by any of this.

### Admin authentication

Per-person `AdminUser` accounts with scrypt password hashes and database-backed sessions (`AdminSession`,
cookie holds a random token, the DB stores only its SHA-256). Every admin page and admin API checks the
session server-side (`src/server/adminAuth.ts`); `proxy.ts` is only a fast pre-filter. Admin mutations
require a same-origin request. Logout revokes the session server-side. There are no default credentials.

### Demo mode and the demo reset

With `DEMO_MODE=true` a yellow banner is shown and payments are simulated. The admin **Reset demo data**
action deletes all campaign data and reloads the demo battle; the server allows it only for a signed-in
admin, same-origin, `DEMO_MODE=true`, `REAL_PAYMENTS_ENABLED` not `true`, the demo payment provider active,
no non-demo payments in the ledger, and the typed phrase `RESET DEMO DATA`.

### Analytics

First-party and cookieless (`AnalyticsEvent` table, `/api/events`): an allow-list of product events
(page views with a returning-visitor flag, side selected, contribution opened/started/completed, amount
bucket, share channel, leaderboard viewed). A random per-tab session id lives in `sessionStorage`; no IP,
name or email is stored; Do Not Track / Global Privacy Control are honoured. The admin control room shows
a 7-day funnel. `@vercel/analytics` adds cookieless page views once Web Analytics is enabled in Vercel.

### Deploying

`npm run build` runs `scripts/migrate-deploy.mjs` before `next build`:

- **Preview builds never modify the database** (previews share the production database); they only
  print `prisma migrate status`.
- **Production builds** run `prisma migrate deploy` (pending migrations only). A database that predates
  migration history is baselined only if it matches `0_init` exactly — otherwise the build fails, the
  live deployment keeps serving, and the difference is printed for review.
- Nothing ever runs `migrate reset` or `db push --accept-data-loss`.

**Changing the schema:** edit `prisma/schema.prisma`, run `npm run db:migrate -- --name <change>`
against a local database, review the generated SQL (it must not drop or rewrite data), commit it, and
deploy. Migration SQL is pinned to LF line endings (`.gitattributes`) because Prisma checksums it.

## What's implemented vs. deferred

**Implemented and tested:** data model with migrations, server-authoritative scoring, idempotent and
concurrency-safe demo payments, terminal-style battle page (arena, chart, ticker, momentum, supporters,
activity), leaderboard and history, contribution flow with anonymous support, share card (WhatsApp, X,
LinkedIn, native share, copy link, image), admin accounts and sessions, campaign management, guarded demo
reset, first-party analytics, graceful "data unavailable" states, SEO metadata, legal pages.

**Deferred — flagged, not silently skipped:**
- A real payment provider — by design, until compliance review is done.
- Supporter accounts (contributions are guest-only; `/profile` is this browser's local history).
- Fraud review queue UI (the `fraudStatus` field and rate limiting exist).
- Creator/referral system (tables exist, no UI).
- Adding further admins from the UI (the first admin is bootstrapped; more can be added later).

## Product principles

1. The backend is the source of truth. 2. The frontend never controls scores. 3. Only verified qualifying
transactions affect totals. 4. Payment processing is idempotent. 5. Campaign state and end time are
server-controlled. 6. User privacy is protected — no PII on leaderboards or activity feeds. 7. No
financial-return promises, no betting/wagering language, no investment advice. 8. Demo data is clearly
labeled. 9. Real-money payments stay disabled until explicitly configured. 10. New campaigns are
configured by admins, not code changes.
