import { prisma } from "@/lib/prisma";
import type { EventName } from "@/lib/analyticsEvents";

export const FUNNEL: { name: EventName; label: string }[] = [
  { name: "page_view", label: "Battle page views" },
  { name: "side_selected", label: "Picked a side" },
  { name: "contribution_flow_opened", label: "Opened contribution" },
  { name: "amount_selected", label: "Chose an amount" },
  { name: "demo_contribution_started", label: "Started contribution" },
  { name: "demo_contribution_completed", label: "Completed (any outcome)" },
  { name: "share_clicked", label: "Shared" },
];

/** Per-event totals and distinct sessions over the last `days` days. */
export async function funnelReport(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<{ name: string; events: bigint; sessions: bigint }[]>`
    SELECT "name", count(*) AS "events", count(DISTINCT "sessionId") AS "sessions"
    FROM "AnalyticsEvent" WHERE "createdAt" >= ${since} GROUP BY "name"`;
  const byName = new Map(rows.map((r) => [r.name, { events: Number(r.events), sessions: Number(r.sessions) }]));
  const [returning, leaderboardViews] = await Promise.all([
    prisma.analyticsEvent.count({ where: { name: "page_view", createdAt: { gte: since }, props: { contains: '"returning":true' } } }),
    prisma.analyticsEvent.count({ where: { name: "leaderboard_viewed", createdAt: { gte: since } } }),
  ]);
  return {
    days,
    steps: FUNNEL.map((s) => ({ ...s, ...(byName.get(s.name) ?? { events: 0, sessions: 0 }) })),
    returningPageViews: returning,
    leaderboardViews,
  };
}
