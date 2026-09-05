# Handoff — Internet Wars

You are picking up an MVP that another developer (working with Claude Code) built from scratch. This
document is written for **you and your AI assistant** — it covers what the project is, what state it's
actually in, how it's put together, the rules that must not be broken, and the traps that will cost you
time if you don't know about them.

Read `README.md` for setup. Read this for judgement.

---

## 1. What this product is

A **community competition platform**. Two sides compete; supporters make a voluntary financial
contribution to the side they identify with; the side with the highest verified qualifying support is
shown as #1. The first (and only) campaign is **Indian Stock Market vs Forex Market**.

It is deliberately **not** a betting, gambling, investment or crowdfunding product, and the language
throughout avoids that framing.

### The constraint you must not casually undo

> Real-money contributions are **switched off**. No payment provider is integrated. `DEMO_MODE=true`
> everywhere. This is pending Indian legal, tax, payment-provider, consumer-protection, privacy,
> age-verification, refund/chargeback and contest/gaming compliance review.

If a task lands on your desk that amounts to "wire up Razorpay and let it take real money", that is a
**business/legal decision, not a technical one**. The code is ready for it (see §6); the clearance is
not. Flag it rather than shipping it.

Related copy rules baked into the product, worth preserving:

- Never describe contributions as bets, wagers, investments, deposits or securities.
- Never promise or imply financial return.
- Never state or imply that a winning side produces a payout to its supporters.
- The disclaimer in the footer and `/legal/disclaimer` is configurable per-campaign (`campaign.disclaimer`).

---

## 2. Where things actually stand

| Lane | State | Notes |
|---|---|---|
| Codebase | **Working** | Type-checks, lints, 11 tests pass, production build passes (last verified on SQLite, see caveat below). |
| GitHub | **Done** | https://github.com/Sameerkhan198/internet-wars — public, `master`, working tree clean. |
| Local dev | **Needs a DB** | Was working on SQLite. The schema is now Postgres, so you need a `DATABASE_URL` before `npm run dev` works. |
| Vercel deploy | **Unverified — likely still broken** | See below. This is the first thing to check. |

### Be sceptical of the deploy status

The final Postgres migration commit (`00693ae`) was pushed but **nobody confirmed the resulting
deployment actually came up**. As of handoff the live URL was returning HTTP 500 from the *previous*
build. Assume it is broken until you load it yourself.

There is also one **known loose end**: a Supabase Postgres database was created and attached to the
Vercel project, but it was never confirmed that the environment variable is named exactly
`DATABASE_URL`. Supabase's Vercel integration typically injects `POSTGRES_URL`,
`POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` — **not** `DATABASE_URL`, which is what
`prisma/schema.prisma` reads.

**Observed at handoff:** `https://internet-wars.vercel.app` returns a 500 whose HTML is a correctly
rendered Next error page — right `<title>`, right meta tags, real chunks. That shape means the app is
serving and dying at **runtime**, not failing to build, and the overwhelmingly likely cause is Prisma
being unable to reach a database.

**First thing to do:**

1. Vercel → project → Deployments. Check whether the latest commit (`6f2c0be`) actually built. If the
   build **failed**, Vercel keeps serving the previous successful deployment — which would explain a 500
   from old code, and the build log will name the real error (`prisma db push` failing for want of
   `DATABASE_URL` is the prime suspect).
2. Vercel → Settings → Environment Variables. If there is no `DATABASE_URL`, add one. Use the value of
   `POSTGRES_URL_NON_POOLING` (the direct, non-pooled connection) — the build runs `prisma db push`,
   which wants a direct connection.
3. Redeploy, then load the site. A working deploy shows an empty-state battle page; sign in at `/admin`
   and click **Load demo data** to populate it.

If you'd rather do this properly than quickly, use Prisma's `directUrl`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        // pooled  -> POSTGRES_PRISMA_URL
  directUrl = env("DIRECT_URL")           // direct  -> POSTGRES_URL_NON_POOLING
}
```

That's the correct long-term shape for Supabase + Prisma + serverless. It was not done because it needs
two variables set correctly and the person doing it isn't a developer.

---

## 3. Stack, and why each choice was made

| Layer | Choice | Why / what to know |
|---|---|---|
| Framework | Next.js **16.3.2**, App Router, Turbopack | See §8 — v16 has renames that will trip up an AI assistant working from older knowledge. |
| UI | React 19.2.8, TypeScript strict | New React lint rules are enforced; see §8. |
| Styling | Tailwind CSS v4 | CSS-first config. Tokens live in `src/app/globals.css` under `@theme inline`, not a `tailwind.config.js`. |
| ORM | Prisma **6.19.3** (pinned) | **Deliberately not v7.** v7 removed `url` from `schema.prisma` in favour of a driver-adapter config. Upgrading is fine but is a real migration, not a version bump. |
| Database | Postgres | Was SQLite; switched because serverless has no persistent disk. |
| Validation | Zod 4 | All request bodies validated server-side. |
| Tests | Vitest 4, against a real database | Not mocked. See §7. |

---

## 4. The invariants — read this before touching money or scores

These are the rules the whole design exists to enforce. There are tests for each. **If you find yourself
writing code that breaks one, you have misunderstood the requirement, not found a shortcut.**

1. **The backend is the only source of truth for scores.** There is no API that accepts a score, a
   total, or a delta from a client. Totals are always *recomputed* from the ledger
   (`src/server/scoring.ts` → `computeCampaignScore`), never incremented in place.

2. **Only `status = SUCCESS` contributions count.** `PENDING`, `FAILED`, `REFUNDED`, `CHARGEBACK` and
   `CANCELLED` rows exist in the table and are deliberately excluded from every total.

3. **A contribution only becomes `SUCCESS` via a verified webhook.** The flow is: create `PENDING` row →
   create payment order → provider confirms → **verify signature** → apply inside one transaction.
   The HTTP response to the browser never determines the outcome.

4. **Webhook processing is idempotent.** The same webhook delivered twice must not double-count. This is
   enforced by only acting while `payment.status === "PENDING"`, and flipping it inside the same
   transaction that read it (`src/server/contributions.ts` → `applyWebhookResult`).

5. **Amounts and team selection are re-validated server-side** against the campaign's
   `minimumContribution` / `maximumContribution` and status. Never trust the client's numbers.

6. **Privacy: no PII on public surfaces.** Leaderboards and the activity feed show a chosen display name
   or `"Anonymous Supporter"` — never email, phone, payment identifiers, UPI ID, or internal user id.
   Anonymous contributions overwrite the display name at write time, so the real name is never even
   stored on that row.

7. **Campaign state and end time are server-controlled.** A campaign past its `endAt` is finalized on
   read (`src/server/campaign.ts` → `maybeFinalize`), which freezes the scoreboard and records a winner.
   The client's clock never decides this.

---

## 5. Codebase map

```
prisma/
  schema.prisma          Data model. 12 models. Postgres.
  seed.ts                Thin CLI wrapper around src/server/seedDemoData.ts

src/
  proxy.ts               Route protection for /admin and /api/admin.
                          NOTE: this is Next 16's renamed middleware.ts (see §8)

  app/
    page.tsx             The battle page (homepage). Server component; fetches
                          initial score/momentum/leaderboard, hands to BattleView.
    leaderboard/         Full supporter leaderboards, per team
    history/             Campaign archive
    profile/             This browser's own contribution history (localStorage)
    legal/[topic]/       rules | terms | privacy | refunds | disclaimer | contact
    admin/               Password-gated dashboard
    admin/login/
    sitemap.ts, robots.ts

    api/
      campaigns/[slug]         GET  score + momentum + campaign meta  (polled by client)
      activity/[slug]          GET  recent activity events            (polled by client)
      leaderboard/[slug]       GET  per-team supporter rankings
      history                  GET  all campaigns with final scores
      contribute               POST create a pending contribution + payment order
      contribute/[id]/status   GET  poll a contribution's status
      webhooks/demo            POST the payment provider callback (signature-verified)
      share                    POST record a share event
      admin/login|logout       Session cookie in/out
      admin/overview           Aggregate metrics
      admin/seed               POST reseed demo data (DEMO_MODE only, admin only)

  server/                *** server-only business logic ***
    scoring.ts           computeCampaignScore, computeMomentum, getTeamLeaderboard
    contributions.ts     initiateContribution, applyWebhookResult, deliverDemoWebhook
    campaign.ts          getCampaignBySlug + maybeFinalize (auto-ends expired campaigns)
    rateLimit.ts         DB-backed fixed-window limiter, IP hashing
    seedDemoData.ts      Demo fixture generator (shared by CLI + admin route)

  lib/
    prisma.ts            PrismaClient singleton
    payments/provider.ts     PaymentProvider interface  <- implement this for a real provider
    payments/demoProvider.ts Demo implementation + HMAC webhook signing
    validation.ts        Zod schemas, display-name sanitising
    adminAuth.ts         Shared-password admin gate (MVP-grade, see §9)
    money.ts             Paise <-> INR formatting
    myContributions.ts   Guest history in localStorage
    types.ts             Shared DTOs

  components/            Client UI. BattleView is the composition root for the
                          battle page; Scoreboard / Countdown / MomentumSection /
                          ActivityFeed / LeaderboardPreview / ContributionModal /
                          ShareCard / AnimatedNumber hang off it.

  hooks/useCampaignPolling.ts   Polls campaign + activity endpoints every 4s

  test/                  setup.ts (env + test schema isolation), dbHelpers.ts
```

### Money is stored in paise

All amounts are **integers in the smallest currency unit** (paise). `₹500` is `50000`. There are no
floats anywhere in the money path. `src/lib/money.ts` handles display. Don't "simplify" this to rupees.

---

## 6. Adding a real payment provider

Everything is behind one interface — `src/lib/payments/provider.ts`:

```ts
interface PaymentProvider {
  createPayment(input): Promise<{ providerOrderId, clientPayload }>
  verifyPayment(providerOrderId): Promise<VerifyPaymentResult>
  handleWebhook(rawBody, headers): Promise<WebhookHandleResult>  // must set `authentic`
  refundPayment(providerTransactionId): Promise<RefundResult>
  getPaymentStatus(providerTransactionId): Promise<Status>
}
```

To integrate a real provider (Razorpay, Cashfree, Stripe…):

1. Implement that interface in `src/lib/payments/<provider>.ts`.
2. `handleWebhook` **must** verify the provider's signature and set `authentic` truthfully. Everything
   downstream trusts that flag — `applyWebhookResult` throws if it's false, and that is the only thing
   standing between a forged HTTP request and the public scoreboard.
3. Change what `getPaymentProvider()` returns. **No business logic should import a concrete provider.**
4. Add a route for that provider's webhook, mirroring `src/app/api/webhooks/demo/route.ts`.
5. Keep storing only reconciliation metadata. **Never** store card numbers, CVV, UPI PIN or banking
   credentials — the schema has no columns for them and it should stay that way.
6. Delete or hard-disable `src/app/api/admin/seed/route.ts` before real contributions exist. It wipes
   all campaign data. It currently refuses to run unless `DEMO_MODE=true`, which is the only thing
   protecting you.

### How the demo provider fakes a callback (and why it looks odd)

`deliverDemoWebhook` in `src/server/contributions.ts` runs the confirmation **synchronously, in-process**,
rather than on a timer.

This looks wrong and isn't. It was originally a `setTimeout` plus an HTTP call back to our own webhook
route. On a serverless host the function is frozen the instant it responds, so that callback never fired
and every contribution sat `PENDING` forever. The in-process version still goes through the identical
signature check and idempotency path. The user still sees a "verifying payment" state because the client
polls `/api/contribute/[id]/status` rather than trusting the response body.

A real provider will restore genuine async delivery, at which point this function goes away.

---

## 7. Tests

```bash
npm run test
```

11 tests across `src/server/scoring.test.ts` and `src/server/contributions.test.ts`. They run against a
**real Postgres database**, not mocks — the point is to prove the ledger behaves, and a mocked Prisma
would prove nothing.

**Isolation:** `src/test/setup.ts` appends `?schema=test` to your `DATABASE_URL`, so tests get their own
Postgres schema. This matters because `resetDb()` truncates every table between tests — pointed at the
default `public` schema it would delete real data on every run. Run `npx prisma db push` once so the
test schema exists.

What's covered (these are the ones worth keeping green):

- A pending contribution never affects the scoreboard
- The same webhook twice doesn't double-count
- An invalid signature is rejected and the ledger is untouched
- A failed payment changes no totals
- Min/max amounts enforced server-side
- Anonymous contributors don't leak their name to the leaderboard
- Percentages survive a zero-total campaign

**Not covered:** any React component, any API route's HTTP layer, the admin auth, rate limiting. If
you're adding meaningful surface area, that's where the gaps are.

---

## 8. Traps — the stuff that will waste your afternoon

These are real and were all hit during the build.

### Next.js 16 is not the Next.js your model remembers

The repo has an `AGENTS.md` (loaded via `CLAUDE.md`) that says so, and it's right. Read
`node_modules/next/dist/docs/` rather than recalling. Specifically:

- **`middleware.ts` is now `proxy.ts`**, exporting a function named `proxy`, not `middleware`. This
  project's route guard is `src/proxy.ts`. If you "helpfully" rename it back, auth silently stops running.
- Route handler `params` is a **Promise** — `await ctx.params`.
- `LayoutProps<"/">` / `RouteContext<...>` are globals generated by `next dev|build|typegen`. If
  `tsc --noEmit` complains they don't exist, run `npx next typegen` — you probably deleted `.next`.

### Prisma is pinned to 6 on purpose

v7 requires a driver-adapter config in a `prisma.config.ts`. Upgrading is a genuine migration. Don't let
a "dependencies are outdated" impulse do it casually.

### `prisma generate` fails with EPERM on Windows

The query engine DLL is locked by the running dev server. Stop the dev server first. Kill it **by port**,
surgically:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

Do **not** use `taskkill /F /IM node.exe` — it kills every Node process on the machine, including your
editor's tooling and any other project's server. (This was done once during the build. It was a mistake.)

### Live pages must stay `force-dynamic`

`/`, `/leaderboard` and `/history` all export `export const dynamic = "force-dynamic"`. Without it Next
prerenders them at build time and the "live" scoreboard freezes at whatever the numbers were when you
deployed. This shipped broken once and was caught reading the build output.

### `requestAnimationFrame` doesn't run in background tabs

`AnimatedNumber` animates the score. rAF is throttled when the tab isn't visible, which left the
displayed total stuck on a stale value indefinitely while the real total moved on. There's a settle
`setTimeout` that force-lands the true value. Don't remove it as "redundant" — it's the correctness path.

### Hydration and the clock

`Countdown` renders a placeholder until mounted. `Date.now()` differs between the server render and
hydration, which is a guaranteed mismatch. Same class of issue in `profile/page.tsx` reading
`localStorage` in an effect. Both have `eslint-disable` comments explaining why — read the comment before
"fixing" it.

### React 19 lint is strict

`react-hooks/set-state-in-effect` and `react-hooks/refs` are errors, not warnings. Two legitimate
external-store reads are suppressed with explanations. Don't blanket-disable the rules.

### No web fonts

`next/font/google` was removed. A network hiccup fetching Inter made Turbopack fail hard and every page
500'd. The system font stack in `globals.css` is the intended design, not a placeholder.

### The demo campaign expires

Seeded campaigns run a **4-day window**, and `maybeFinalize` correctly auto-ends them. If the site looks
"finished" instead of live, that's the end-of-battle logic working. Reseed:

```bash
npm run db:seed          # locally
```
or sign in at `/admin` and click **Load demo data** (works against the deployed database too).

---

## 9. Security posture — honest assessment

Implemented: server-side validation everywhere, DB-backed rate limiting on contribute and admin login,
HMAC webhook signature verification, idempotent payment application, IP hashing rather than plaintext
storage, no payment credentials stored, admin routes gated at the proxy layer, `.env` and `*.db`
gitignored.

**Weak points you should fix before this is public-facing:**

1. **Admin auth is a single shared password** (`ADMIN_PASSWORD`) with an HMAC session cookie
   (`src/lib/adminAuth.ts`). There is an `AdminUser` table in the schema with `passwordHash`/`role`
   columns that nothing uses yet. Replace with real auth (NextAuth/Clerk) before more than one operator.
2. **The README documents the default admin password**, and the repo is public. Whatever `ADMIN_PASSWORD`
   is set to in Vercel must not be that value.
3. **No CSRF tokens.** Cookie is `SameSite=Lax`, which covers the common cases, but the admin mutations
   have no explicit CSRF protection.
4. **Rate limiting is per-IP and naive** — a fixed window in the DB. Fine for a demo, trivially defeated
   by a distributed client.
5. **The seed endpoint deletes all campaign data.** Admin-gated and `DEMO_MODE`-gated, but it exists.
6. **`prisma db push` runs on every build.** No migration history, no rollback. Move to
   `prisma migrate deploy` before this holds data anyone cares about.

---

## 10. Deliberately not built

Each has a real extension point rather than a stub that pretends to work.

| Not built | State |
|---|---|
| User accounts / auth | Guest contributions only. `/profile` reads this browser's localStorage. `User` table exists and `contribution.userId` is wired but always null. |
| Fraud review UI | `contribution.fraudStatus` enum (`FLAGGED`/`UNDER_REVIEW`/`CLEARED`/`BLOCKED`) and rate limiting exist. No admin screen to action them. |
| Creator / referral system | `Creator` and `Referral` tables exist. No UI, no attribution tracking. The intended URL shape was `/forex?ref=<code>`. |
| Deeper analytics | Admin has core metrics. No acquisition source, repeat-contribution rate, or contribution concentration. |
| Campaign CRUD in admin | Campaigns are created by the seed routine only. No create/edit/pause/end UI, though the status enum supports all of it. |
| Real payments | Blocked on compliance. See §1 and §6. |

### If you're looking for the highest-value next work

1. Confirm and fix the Vercel deployment (§2) — nothing else matters until the live URL works.
2. Replace `prisma db push` with real migrations.
3. Real admin auth, and rotate the admin password.
4. Campaign management UI — right now a second campaign requires editing the seed script, even though
   the entire data model already supports arbitrary two-sided campaigns (Android vs iPhone, Tea vs
   Coffee, etc.). This is the cheapest way to make the product more than a one-off.

---

## 11. Environment variables

Nothing here is committed. `.env` is gitignored. Create your own from this table.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | Postgres connection string. Everything fails without it. |
| `DEMO_MODE` | **Yes** | `"true"`. Gates the simulated payment confirmation *and* the seed endpoint. Setting it to false with no real provider integrated means contributions can never complete. |
| `NEXT_PUBLIC_DEMO_MODE` | Yes | `"true"`. Client-side twin — drives the yellow DEMO MODE banner. Keep in sync with `DEMO_MODE`. |
| `DEMO_PAYMENT_FAILURE_RATE` | No | `0`–`1`, default `0.08`. Fraction of demo payments that resolve as FAILED, so the failure UI is exercised. |
| `WEBHOOK_SECRET` | Yes | HMAC secret for signing/verifying demo webhooks. Replace with the real provider's secret later. |
| `ADMIN_PASSWORD` | Yes | Admin dashboard password. **Do not use the value in the README.** |
| `ADMIN_SESSION_SECRET` | Yes | Signs the admin session cookie. |
| `NEXT_PUBLIC_APP_URL` | No | Used for share links, sitemap and `metadataBase`. Falls back to the request origin. |

---

## 12. Commands

```bash
npm install
npm run dev            # dev server on :3000
npm run build           # prisma generate && prisma db push && next build
npm run start            # run the production build
npm run lint              # eslint
npm run test               # vitest (needs DATABASE_URL)
npm run db:push            # sync schema to the database
npm run db:seed            # wipe + reseed demo data
npm run db:studio          # Prisma Studio GUI
npx next typegen           # regenerate Next's route/layout types
```

Admin dashboard: `/admin` → password is `ADMIN_PASSWORD`.

---

## 13. Accounts and access

| Thing | Account | Notes |
|---|---|---|
| GitHub | `Sameerkhan198` | Repo is **public**. You'll need push access adding, or fork + PR. |
| Vercel | team `Yarana` (Hobby plan), project `internet-wars` | Deploys automatically from `master`. |
| Database | Supabase Postgres, `supabase-almond-cushion` | Created through Vercel's marketplace integration. |
| Payment provider | none | Intentionally. |

No credentials are in the repo, and none were shared through the assistant. You'll need your own access
to the Vercel and Supabase dashboards from the original owner.

---

## 14. Commit history

| Commit | What |
|---|---|
| `86e2433` | Initial commit — the whole MVP (75 files) |
| `2cb5471` | Replace SSE push updates with polling for serverless compatibility |
| `1c215ec` | Drop `next/font/google` dependency |
| `00693ae` | Move to Postgres; make demo payments serverless-safe; admin seed button |

`PROGRESS_REPORT.md` in this repo is the narrative build report from the original session — useful for
*why* things are the way they are. This document is the operational one.

---

## 15. A note on working with an AI assistant on this repo

`CLAUDE.md` → `AGENTS.md` is auto-maintained by `next dev` and warns that this Next version diverges from
model training data. Leave it in place.

The single most useful instruction to give your assistant here: **the invariants in §4 are requirements,
not implementation details.** The most likely way this project gets quietly broken is an assistant
"simplifying" the pending→verified→scored flow into something that updates a total directly, because
that is shorter and looks equivalent. It is not equivalent, and the tests in
`src/server/contributions.test.ts` exist to catch exactly that.
