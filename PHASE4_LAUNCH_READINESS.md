# Phase 4 — Launch Readiness

**Date:** 28 September 2026 · **Scope:** make the working demo safe for a controlled public **demo** launch.
Real-money functionality is out of scope and remains disabled.

## Verdict

**Technically ready for a controlled public DEMO launch once the human actions below are done** — chiefly
creating the first admin account and removing the local `import.env`. The Supabase free-tier auto-pause
is acceptable for a controlled demo but not for sustained public traffic (see Database reliability).

**Not** ready for real money: that needs compliance clearance, a real payment provider, and the items in
“Before real money”.

## What changed (commits)

| Commit | Change |
|---|---|
| `0a1d3c8`, `dd9c30b` | Trading-terminal redesign (bull/bear arena, battle chart, ticker, phone fixes) |
| `1541386` | Real-PostgreSQL test runner and local dev database scripts |
| `82004b8` | Merge of `feature/terminal-ui` into `master` (normal merge commit, reviewed first) |
| `d45170d` | Terminal UI for leaderboard and history; data-driven side themes; data-unavailable state |
| `2d4c5dc` | Migration history: baseline `0_init`, build-time `migrate-deploy.mjs` replaces `db push` |
| `a216c92` | Admin accounts + DB sessions; hardened demo reset; `WEBHOOK_SECRET` fails closed |
| `0aac550` | Ledger fixes: atomic webhook claim, idempotent finalization, no nested DB connections |
| `4b196da` | Honest degradation when the DB is down; public API hardening; activity order fix |
| `7e7470d` | Admin campaign management |
| `cb34656` | First-party analytics, data-true share card, accessible contribution dialog |
| (this commit) | Profile loading state, README, this document, progress report |

## Migrations

| Migration | Content | Production |
|---|---|---|
| `0_init` | The schema production already had (generated from `4b77d3b`) | Recorded as applied after the build-time drift check found **no drift** |
| `20260928141113_admin_sessions` | `AdminUser.lastLoginAt`, new `AdminSession` table | Applied (additive) |
| `20260928151828_analytics_events` | New `AnalyticsEvent` table | Applied on the deploy of this phase (additive) |

No migration drops, renames or rewrites data. Production data was verified intact after each deploy
(same campaign, same 164 supporters).

**Deployment procedure:** push to `master` → Vercel build runs `prisma generate` →
`scripts/migrate-deploy.mjs` → `next build`. Preview builds never migrate (they share the production
database). A drift between the live DB and history fails the build without changing anything.

## Security changes

- **Admin:** per-person accounts (existing `AdminUser` table), scrypt hashes, DB-backed sessions
  (SHA-256 of a random token stored, cookie HttpOnly + SameSite=Strict + Secure), server-side checks on
  every admin page and API, same-origin requirement on mutations, login/setup rate limits, logout revokes
  server-side, no default credentials. First admin via one-time setup (`INITIAL_ADMIN_EMAIL` + existing
  `ADMIN_PASSWORD` as setup secret, never stored).
  *Why not Auth.js/Clerk/Supabase Auth:* one or two operators, email+password is enough, and the schema
  already had `AdminUser`. A third-party provider would add accounts/config and a dependency for no
  security gain at this scale. Revisit if many operators or SSO are needed.
- **Demo reset:** server-side guard (admin + same-origin + `DEMO_MODE=true` + `REAL_PAYMENTS_ENABLED`
  not true + demo provider + no non-demo payments in the ledger + typed phrase). Direct API calls outside
  demo mode are refused (tested).
- **Webhook secret:** production refuses to sign/verify without `WEBHOOK_SECRET` (the old fallback value
  is public in this repo).
- **Public APIs:** drafts hidden; share channels allow-listed and rate limited; malformed `limit` no
  longer crashes the activity API; DB failures return 503 without internals.
- **Secrets audit:** `import.env` has never been committed; none of its values appear anywhere in git
  history or the client bundle (checked by value match, values not printed). The app uses only the two
  Supabase Postgres connection strings; the integration's other keys (anon, service role, JWT secret) are
  not referenced by any code or shipped to the browser.

## Payment-ledger tests (real PostgreSQL 17.10)

`npm run test:pg` — 4 files, **31 tests, all passing**, also passing with `TEST_PG_CONNECTION_LIMIT=1`.

| # | Requirement | Covered by |
|---|---|---|
| 1 | Pending never changes totals | `contributions.test` — pending contribution |
| 2 | Success changes totals exactly once | `contributions.test` verified webhook; `ledger.test` 10× concurrent |
| 3 | Failed changes nothing | `contributions.test`; `ledger.test` cross-view test |
| 4 | Duplicate webhook idempotent | `contributions.test` replay; `ledger.test` conflicting late webhook |
| 5 | Invalid HMAC rejected | `contributions.test` invalid signature |
| 6 | Server-side amount validation | `contributions.test` min/max; campaign status |
| 7 | Anonymous privacy | `contributions.test`; `ledger.test` (stored row, activity, leaderboard) |
| 8 | Concurrent webhooks don't double-credit | `ledger.test` — 10 simultaneous deliveries → 1 credit, 1 activity, 1 snapshot |
| 9 | Leaderboard = SUCCESS only | `ledger.test` cross-view test |
| 10 | History/chart use the same ledger truth | `ledger.test` — chart's last point equals scoreboard totals; series monotonic |

**Bugs found and fixed at the ledger layer:** (a) concurrent webhook deliveries could each fire success
side effects; (b) the webhook transaction opened a second DB connection — with a one-connection pool it
waited on itself until timeout (reproduced, then fixed); (c) simultaneous readers after a battle's end
could each write "battle ended". Totals themselves were never double-counted (they are recomputed).

## Campaign management

Admin → **New battle** creates a `DRAFT`. Actions: schedule, back to draft, start now, pause, resume,
close, cancel. One `LIVE`/`PAUSED` battle at a time (advisory-locked check; racing starts → exactly one).
Scheduled battles open automatically at their start time only if nothing else is active. Running battles
allow presentation edits and a later end time only; closed battles are read-only; contribution rows are
never modified. **No schema change was needed.** Per-side colour/emblem uses `Team.accentTheme` (bull,
bear, blue, amber, cyan, orange; legacy values fall back to bull/bear).

## Analytics

Events: `page_view` (with `returning`), `side_selected`, `contribution_flow_opened`, `amount_selected`
(bucket), `demo_contribution_started`, `demo_contribution_completed` (success/failed), `share_clicked`
(channel), `leaderboard_viewed`. First-party, cookieless, DNT/GPC honoured, no IP/name/email stored,
unknown events/properties dropped. Admin shows a 7-day funnel. **MXT: no integration of any kind**, per
the Phase 4 decision.

## Share

Share card and text use only server-verified numbers (side share, leading/behind by, supporters) plus the
battle URL; no personal amount, no urgency copy. WhatsApp, X, LinkedIn, native share sheet, copy link,
downloadable image in the side's theme.

## Responsive and accessibility

Automated audit: **11 pages × 9 widths (1920, 1440, 1366, 1280, 768, 430, 390, 375, 360) = 99 checks,
0 issues** — no horizontal page overflow, no content off-screen, every interactive control has an
accessible name (includes signed-in admin pages). Contribution dialog: `role=dialog`, `aria-modal`,
labelled, focus moved in and returned, Escape closes, Tab trapped (verified in browser). Visible focus
rings, reduced-motion support, text labels alongside colour (▲/▼, “Bull side”, status tags). Contrast
by calculation: muted text ≈ 5.3:1, black on green ≈ 9:1, black on red ≈ 5.5:1.

## Error / empty / loading states

DB down (tested by stopping the database): pages show “Feed unavailable” with **no numbers**, APIs return
503, a live page shows “Live feed interrupted — showing the last verified figures from HH:MM:SS IST” and
recovers by itself. Styled 404 and error boundary. Empty states for no battle, no supporters, no
activity, no history; scheduled (“Opens in”), paused, closed and cancelled battle states.

## Database reliability (Supabase)

- Current: Supabase **Free**, project `supabase-almond-cushion` (Mumbai), billed via the Vercel
  Marketplace integration (org “Yarana”). Free projects **pause after about a week without activity**
  — this happened once already (27 Sep). When paused, the site now shows “unavailable” states instead of
  crashing, but it stays down until someone resumes the project in the Supabase dashboard.
- Minimum launch-ready plan: a paid Supabase plan (no auto-pause, automatic daily backups). Check current
  pricing in the dashboard; upgrading is a billing decision and was **not** done.
- For a short, actively monitored demo, Free is workable if someone checks the dashboard daily.

## Human actions required

1. **Create the first admin account** at `/admin/login` (email `INITIAL_ADMIN_EMAIL`, setup secret =
   the deployment's `ADMIN_PASSWORD`, choose a new password ≥ 12 characters).
2. **Then delete `D:\internetwars\import.env`** (local only, never committed) and the desktop notes file
   containing account passwords. Optionally remove `ADMIN_SESSION_SECRET` from Vercel (no longer used).
3. **Rotate the Supabase credentials flagged “Needs Attention” in Vercel** (Vercel → internet-wars →
   Settings → Environment Variables → “Rotate Supabase Secrets”), make sure they're stored as *Secret*,
   then redeploy and check the site. Brief downtime is possible during rotation — do it at a quiet time.
4. **Enable Vercel Web Analytics** (Vercel → internet-wars → Analytics → Enable) for page views.
5. **Decide on the Supabase plan** before sending real public traffic (see above).
6. Optional: set `DEMO_MODE`/`NEXT_PUBLIC_DEMO_MODE`/`WEBHOOK_SECRET` for **Preview** too, so preview
   links fully work — but note previews share the production database.

## Before real money (not part of this phase)

Legal/tax/payment/gaming compliance sign-off; a real provider implementing `PaymentProvider` with
verified webhooks; `REAL_PAYMENTS_ENABLED=true` (which also hard-disables the demo reset); remove or
disable the demo-reset endpoint; separate preview database; refunds/chargebacks handling; fraud review UI;
supporter accounts if required; paid database plan with backups and a tested restore.
