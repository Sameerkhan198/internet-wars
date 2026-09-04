# Internet Wars — Indian Stock Market vs Forex Market

A community competition platform. Users pick a side (Indian Stock Market or Forex Market) and make a
voluntary contribution to support it; the side with the highest verified qualifying support is shown as
the leader. This is **not** betting, investing, or a financial product — see [Product principles](#product-principles)
and the in-app disclaimer.

**Status: MVP, DEMO MODE only.** No real payment provider is wired up. Real-money contributions must not
be enabled until legal, tax, payment-provider, consumer-protection, privacy, and applicable contest/gaming
compliance review is complete for the Indian market.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- **Styling:** Tailwind CSS v4
- **Database:** Postgres via Prisma 6, in both local dev and production
- **Live updates:** short-interval polling (works identically on a persistent server and on serverless)
- **Validation:** Zod
- **Tests:** Vitest, running against a real (SQLite) database

## Getting started

You need a Postgres database. Any will do — a hosted one (Neon, Supabase, Vercel Postgres) is easiest,
and a free tier is plenty. Put its connection string in `.env` as `DATABASE_URL`, then:

```bash
npm install
npm run db:push      # create the tables
npm run db:seed       # populate demo campaign, teams, ~180 demo contributions
npm run dev
```

Open http://localhost:3000. Admin dashboard: http://localhost:3000/admin/login (password from
`ADMIN_PASSWORD` in `.env`, default `changeme123` — change this before deploying anywhere reachable).

## Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma datasource. `file:./dev.db` locally; a Postgres URL in production. |
| `DEMO_MODE` | Must be `"true"` until a real payment provider is integrated. Gates the simulated webhook delivery timer. |
| `NEXT_PUBLIC_DEMO_MODE` | Same flag, exposed client-side to show the DEMO MODE banner. Keep in sync with `DEMO_MODE`. |
| `DEMO_PAYMENT_FAILURE_RATE` | Fraction (0–1) of demo payments that resolve as FAILED, to exercise the failure UI. |
| `WEBHOOK_SECRET` | HMAC secret the demo provider uses to sign webhook payloads. Rotate for a real provider's actual secret. |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Minimal admin gate — see [Auth](#auth-notes). |
| `NEXT_PUBLIC_APP_URL` | Base URL used for share links, sitemap, and the demo webhook's self-callback. |

## Scripts

```bash
npm run dev          # dev server
npm run build         # production build
npm run start          # run the production build
npm run lint            # eslint
npm run test             # vitest (uses prisma/test.db, separate from dev.db)
npm run db:push          # sync Prisma schema to the database
npm run db:seed          # reset + reseed demo data
npm run db:studio         # Prisma Studio GUI
```

## Architecture

```
src/
  app/                  Routes (App Router) — pages + API route handlers
  components/            Client-side UI (scoreboard, contribution modal, activity feed, ...)
  server/                 Server-only business logic: scoring engine, contribution/webhook
                            processing, campaign lifecycle, rate limiting, realtime pub/sub
  lib/                     Shared utilities: Prisma client, money formatting, validation schemas,
                            payment provider abstraction, admin auth
  proxy.ts                 Next 16's renamed middleware — gates /admin routes
prisma/
  schema.prisma            Data model (Campaign, Team, Contribution, Payment, ActivityEvent, ...)
  seed.ts                  Demo data generator
```

### The scoring rule this whole app is built around

**The frontend never sets a score.** Team totals are always recomputed server-side from
`Contribution` rows with `status = SUCCESS` (`src/server/scoring.ts`). A contribution starts
`PENDING` and only becomes `SUCCESS` after a payment webhook is received, its signature verified, and
applied inside a single idempotent transaction (`src/server/contributions.ts`). See the test suite
(`src/server/contributions.test.ts`) for the specific guarantees this is built to hold:

- A `PENDING` contribution never affects the public scoreboard.
- The same webhook delivered twice does not double-count.
- A webhook with an invalid signature is rejected and never touches the ledger.
- Contribution amounts are validated server-side against campaign min/max — never trusted from the client.
- Anonymous contributions never leak the real display name, including on the leaderboard.

### Payment provider abstraction

`src/lib/payments/provider.ts` defines the interface (`createPayment`, `verifyPayment`,
`handleWebhook`, `refundPayment`, `getPaymentStatus`). `src/lib/payments/demoProvider.ts` is the only
implementation right now: it fabricates an order, decides an outcome, and — after a short delay — POSTs a
signed payload to `/api/webhooks/demo`, exercising the exact same verification path a real provider's
webhook would. To integrate a real provider (Razorpay, Cashfree, Stripe, etc.), implement the same
interface and swap what `getPaymentProvider()` returns; no other code should need to change.

### Demo mode

With `DEMO_MODE=true`, every contribution is followed by a simulated webhook 1.5–4s later
(`DEMO_PAYMENT_FAILURE_RATE` fraction resolve as FAILED). A yellow "DEMO MODE" banner is shown site-wide
whenever `NEXT_PUBLIC_DEMO_MODE=true`. No code path can move real money in this configuration.

### Auth notes

Guest contributions are the primary path (choose a username or contribute anonymously — see
`src/lib/validation.ts` and `ContributionModal.tsx`). `/profile` reads a browser-local list of the
current browser's own successful contributions (`src/lib/myContributions.ts`) since there is no account
system yet — this is a convenience, not a source of truth, and holds no payment data.

`/admin` is protected by a single shared password (`ADMIN_PASSWORD`) and a signed session cookie
(`src/lib/adminAuth.ts`, enforced in `src/proxy.ts`). This is intentionally minimal for the MVP —
**replace it with a real auth provider (NextAuth, Clerk, etc.) backed by the `AdminUser` table before this
is used by more than one operator or exposed publicly.**

### Deploying

The `build` script runs `prisma db push` before `next build`, so a fresh deployment creates its own
tables as long as `DATABASE_URL` is set in the host's environment. That's deliberate for an MVP with no
migration history — **replace it with `prisma migrate deploy` and versioned migrations before this holds
data anyone cares about**, since `db push` has no rollback story.

Once deployed, sign in at `/admin` and use **Load demo data** to populate the demo battle. That route
runs the same seed routine as `npm run db:seed`, but from inside the deployed app, so the production
connection string never has to leave the host. It refuses to run unless `DEMO_MODE=true`, and it deletes
all existing campaign data before reseeding.

### Running the tests

Tests need `DATABASE_URL` set. They run against a `test` schema on that same database (the connection
string gets `?schema=test` appended automatically in `src/test/setup.ts`), so a test run truncating
tables can't touch your real data. Create the test schema once with:

```bash
npx prisma db push
```

## What's implemented vs. deferred

**Implemented and tested:** campaign/team/contribution/payment data model, server-authoritative scoring
engine, demo payment provider with idempotent signature-verified webhooks, live scoreboard + countdown +
momentum + activity feed over SSE, contribution flow with quick/custom amounts and anonymous support,
supporter leaderboards, share cards (native canvas, no external deps) with WhatsApp/X/Telegram/copy-link,
battle history, basic admin overview (metrics, campaigns, recent transactions) behind a password gate,
rate limiting on contribute/admin-login, SEO (sitemap, robots, OG/Twitter metadata), legal/disclaimer
pages, and a vitest suite covering the safety-critical paths above.

**Deferred — flagged, not silently skipped:**
- Full account auth (the spec's email/passwordless system) — guest contributions + a minimal admin
  password gate stand in for now.
- Fraud review queue UI (FLAGGED/UNDER_REVIEW/CLEARED/BLOCKED) — the `fraudStatus` field and rate limiter
  exist; there's no admin screen to act on them yet.
- Creator/referral dashboard — the `Creator`/`Referral` tables exist in the schema; no UI yet.
- Broader analytics (acquisition source, repeat-contribution rate, contribution concentration) — the
  admin overview covers the core metrics only.
- A real payment provider integration — by design, until compliance review is done.

## Product principles

1. The backend is the source of truth. 2. The frontend never controls scores. 3. Only verified qualifying
transactions affect totals. 4. Payment processing is idempotent. 5. Campaign state and end time are
server-controlled. 6. User privacy is protected — no PII on leaderboards or activity feeds. 7. No
financial-return promises, no betting/wagering language, no investment advice. 8. Demo data is clearly
labeled. 9. Real-money payments stay disabled until explicitly configured. 10. Future campaigns (the
schema supports any two-sided campaign, not just Stocks vs. Forex) don't require rewriting core logic.
