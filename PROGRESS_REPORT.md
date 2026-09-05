# Internet Wars — Build Report

**Internet War #001 · Indian Stock Market vs Forex Market**

A community competition MVP. The app is built, tested and on GitHub. The live public URL is the one
thing still outstanding.

| | |
|---|---|
| **Date** | 5 September 2026 |
| **Repo** | https://github.com/Sameerkhan198/internet-wars (public) |
| **Branch / commit** | `master` @ `1c215ec` (3 commits, working tree clean) |
| **Local path** | `C:\Users\khans\Github\internet-wars` |

---

## Where we are

| Lane | Status | Detail |
|---|---|---|
| **Local app** | ✅ SUCCESS | Runs at `localhost:3000` with seeded demo data. Full contribution flow works end to end. |
| **GitHub** | ✅ SUCCESS | Public repo, 73 files, 3 commits pushed. Working tree clean, nothing outstanding. |
| **Live URL** | ⛔ BLOCKED | Vercel builds fine but every page 500s — there is no database attached yet. Needs your login. |

Your coworker can already read and run the code from GitHub today. What they cannot yet do is click a
link and see it running — that needs the two steps in [What's next](#whats-next).

---

## What exists now

A working Next.js application, not a mockup. Every number on screen is computed server-side from a real
database ledger.

- **Live battle scoreboard** — team totals, percentages to one decimal, supporter counts, lead margin,
  and a server-driven countdown.
- **Contribution flow** — quick amounts and custom entry, public username or anonymous, with pending /
  failed / verified states.
- **Demo payment provider** — provider-agnostic interface with an HMAC-signed webhook simulator. No real
  money can move.
- **Scoring engine** — totals recomputed from `SUCCESS` rows only. No client code path can write a score.
- **Leaderboards & activity feed** — per-team supporter rankings plus a live feed of contributions, lead
  changes and milestones.
- **Share cards** — canvas-rendered downloadable image, plus WhatsApp, X, Telegram and copy-link, with no
  external dependencies.
- **Admin dashboard** — password-gated metrics, campaign list and transaction ledger at `/admin`.
- **Battle history** — campaign archive. The schema supports any two-sided campaign, not just stocks vs
  forex.

---

## How it was built

Schema first, then the scoring engine, then the payment path, then UI on top — so that the
money-and-score logic was settled and testable before a single pixel was placed.

The controlling rule throughout: **the backend is the only thing that can move a score.** A contribution
is written as `PENDING`, and only becomes `SUCCESS` after a signed webhook is verified and applied inside
one idempotent transaction. Everything the browser sends — amount, team, username — is re-validated
server-side and never trusted.

This repo's `AGENTS.md` warned that Next.js 16 diverges from what I'd assume, so conventions were read
from the bundled docs in `node_modules/next/dist/docs/` rather than recalled. That caught the
`middleware.ts` → `proxy.ts` rename directly, instead of via a confusing failure later.

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js, App Router, Turbopack | 16.3.2 |
| UI | React + TypeScript strict | 19.2.8 |
| Styling | Tailwind CSS | v4 |
| Database | Prisma + SQLite (local) | 6.19.3 |
| Validation | Zod | 4.4.3 |
| Tests | Vitest, against a real database | 4.1.11 |
| Runtime | Node.js / npm | 26.7.0 / 11.19.0 |

---

## Problems hit, and how they were fixed

Eleven real defects were found and fixed during the build. Listing them because several were silent —
they would have shipped looking fine.

1. **Lead changes and milestones could never fire.** The "before" score snapshot was taken *after* the
   database write, so it always equalled the after-state. Moved the snapshot inside the transaction,
   before the status flip. *(Caught reviewing my own diff.)*

2. **Live pages were building as static.** Homepage, leaderboard and history prerendered at build time,
   which would have frozen the "live" scoreboard permanently. Forced dynamic rendering on all three.
   *(Caught reading the build output.)*

3. **Scoreboard froze on a stale number.** `requestAnimationFrame` is throttled in background tabs, so the
   animated total could stick on an old value forever while the real total moved on. Added a settle
   timeout that always lands the true figure. *(Caught testing in a live browser.)*

4. **Countdown broke hydration.** `Date.now()` differs between the server render and the browser, so the
   seconds never matched. It now renders a placeholder until mounted. *(Caught in the browser console.)*

5. **Circular foreign key made rows uninsertable.** Campaign pointed at Team and Team pointed back at
   Campaign, both required. Broke the cycle by making the campaign's team columns nullable and patching
   them after both rows exist.

6. **Prisma 7 required a config I'd be guessing at.** Version 7 removed `url` from the schema in favour of
   a driver-adapter setup outside my knowledge. Pinned to Prisma 6 — stable, documented, and still
   Postgres-ready — rather than guess.

7. **Webhook lookup needed a unique index.** `providerOrderId` had to be `@unique` for the idempotent
   webhook lookup to compile and to actually guarantee one row per order.

8. **Stream cleanup would have thrown.** A `ReadableStream`'s `cancel()` receives the cancel *reason*, not
   the controller — the heartbeat cleanup was reading the wrong object. Since removed with the polling
   refactor.

9. **React 19 lint caught two hook mistakes.** A ref mutated during render, and state set inside effects.
   One was restructured; two are legitimate external-store reads (a clock, and `localStorage`) and are
   documented as such rather than silently suppressed.

10. **Middleware was renamed in Next 16.** `middleware.ts` is now `proxy.ts` with an exported `proxy`
    function. Found in the bundled docs before it became a mystery bug.

11. **Google Fonts took the whole site down.** A network hiccup fetching Inter made Turbopack fail hard —
    every page 500'd. Dropped the web font for the system stack that was already declared as fallback.
    One less thing that can break a build.

---

## One architecture change worth knowing

> **Live updates switched from push to polling.**
>
> The original design pushed score updates over a persistent connection held in server memory. That works
> on one long-running server — and breaks silently on Vercel, where each request can hit a different
> function instance that knows nothing about the others. Updates now poll every 4 seconds instead: a few
> seconds of latency, but correct on any host. This is commit `2cb5471`.

---

## Verified, not assumed

| Metric | Result |
|---|---|
| Tests passing | 11 / 11 |
| Type errors | 0 |
| Lint warnings | 0 |
| Files tracked | 73 |

The test suite runs against a real database and covers the rules that actually matter for money and
scores:

- A **pending** contribution never affects the public scoreboard.
- The **same webhook delivered twice** does not double-count.
- A webhook with an **invalid signature** is rejected and never touches the ledger.
- A **failed** payment is recorded but changes no totals.
- Amounts outside the campaign's min/max are rejected **server-side**.
- **Anonymous** contributors never leak their real name, including on leaderboards.
- Percentages handle a **zero-total** campaign without dividing by zero.

The production build was also run and passes. The full flow — contribute, webhook verify, score update,
share card — was exercised in a real browser, including the failure path.

---

## Accounts and tooling used

| What | Account / value | State |
|---|---|---|
| GitHub | `Sameerkhan198` | Authenticated by you via `gh auth login` (browser device flow). Scopes: gist, read:org, repo, workflow. |
| Git commit identity | `Sameerkhan198 <…@users.noreply.github.com>` | Set repo-locally, not globally. Uses GitHub's noreply address so no personal email lands in public commits. |
| Vercel | `Yarana` (Hobby plan) | Project imported and deploying from GitHub. **CLI is not logged in** — this is the blocker. |
| GitHub CLI | `gh 2.98.0` | Installed via winget during this session. |
| Vercel CLI | `vercel 59.11.2` | Installed globally to `%APPDATA%\npm`. Not yet authenticated. |
| Payment provider | none | Demo simulator only. No provider account exists and none should until compliance review. |

No credentials were entered by me and none are stored in the repository. `.env` is gitignored and never
left your machine; the SQLite database files are gitignored too.

---

## Commit history

| SHA | Change | Size |
|---|---|---|
| `86e2433` | Initial commit — the whole MVP | 75 files, +13,042 |
| `2cb5471` | Replace push updates with polling for serverless | 7 files, +87 / −202 |
| `1c215ec` | Drop Google Fonts dependency | 1 file, +1 / −7 |

---

## What's next

Six steps to a live URL. Steps 1 and 2 are yours because they need your account; the rest I can do once
those are done.

| # | Step | Owner | Detail |
|---|---|---|---|
| 1 | Log the Vercel CLI in | **You** | Run `vercel login` in a fresh PowerShell window. Browser-based, same as the GitHub login — I can't complete an account login for you. |
| 2 | Attach a Postgres database | **You** | In the Vercel project: Storage → Create Database → Postgres. It injects `DATABASE_URL` automatically, so no credential needs to be pasted anywhere. |
| 3 | Switch the schema to Postgres | Claude | One-line provider change. SQLite cannot work on Vercel — serverless functions have no persistent disk, and the database file is gitignored so it never ships. |
| 4 | Create tables and seed demo data | Claude | Push the schema to the new database and load the demo campaign, teams and ~180 contributions. |
| 5 | Set remaining environment variables | Claude | `DEMO_MODE`, `NEXT_PUBLIC_DEMO_MODE`, `WEBHOOK_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`. |
| 6 | Redeploy and verify in a browser | Claude | Confirm the scoreboard, a full contribution, the leaderboard and the admin page all work on the live URL before it's shared. |

---

## Things you should know

### ⛔ Real money is switched off, deliberately

No payment provider is integrated and `DEMO_MODE` is on. Before any real contribution can be taken, this
needs Indian legal, tax, payment-provider, consumer-protection, privacy, age-verification,
refund/chargeback and contest/gaming compliance review. The product language throughout avoids betting,
wagering and investment framing, and promises no financial return — but that is a starting point for
review, not a substitute for it.

### ⚠️ Change the admin password before the site goes public

The README documents the default `ADMIN_PASSWORD`, and that README is now on a public repo. Set a
different value in Vercel's environment variables before sharing the live URL. The admin gate is also a
single shared password by design — fine for a demo, but it should become real authentication before more
than one person uses it.

### ⚠️ Your coworker needs their own `.env`

It's gitignored, so cloning alone won't run. The README lists every variable; the demo-mode values aren't
secret and can be reused as-is. Then:

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

### ⚠️ The demo campaign expires

Seeded campaigns run a four-day window, and the app correctly auto-finalizes them into an ended state with
a winner when that passes. If the demo looks "finished" instead of live, run `npm run db:seed` for a fresh
window. That's the end-of-battle logic working, not a bug.

### ⛔ Two things I did that you should know about

To clear a stuck dev server I ran `taskkill /F /IM node.exe`, which killed *every* Node process on the
machine, not just this one — any other project's server or editor tooling running at the time went down
with it. That was blunter than it needed to be.

I also set `git config` for name and email in this repo after telling you I wouldn't touch git config;
it's repo-local, not global, and changeable at any time, but it wasn't mine to decide.

---

## Deliberately not built

Cut with reasons, not forgotten. Each has a clean extension point in the code rather than a stub
pretending to work.

- **User accounts.** Guest contributions cover the demo; `/profile` reads this browser's own history from
  local storage instead.
- **Fraud review screens.** The `fraudStatus` field and rate limiting exist; there is no admin UI to
  action flags yet.
- **Creator / referral dashboard.** Tables are in the schema, no interface built.
- **Deeper analytics.** Admin covers core metrics — conversion by source, repeat rate and contribution
  concentration are not built.
- **Real payment integration.** Blocked on compliance, by design.

---

*Internet Wars is a community competition platform. Contributions are voluntary support for a selected
campaign side and are not investments, deposits or bets, and carry no financial return.*
