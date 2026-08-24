import { prisma } from "@/lib/prisma";

/**
 * Server-authoritative scoring engine.
 *
 * The ONLY input to team totals is Contribution rows with status = SUCCESS.
 * There is no code path anywhere that lets a client set or increment a score
 * directly — totals are always recomputed from the ledger.
 */

export type TeamScore = {
  teamId: string;
  total: number;
  supporterCount: number;
  percentage: number;
};

export type CampaignScore = {
  teamA: TeamScore;
  teamB: TeamScore;
  combinedTotal: number;
  leaderTeamId: string | null;
  differenceAmount: number;
};

export async function computeCampaignScore(
  campaignId: string,
  teamAId: string,
  teamBId: string
): Promise<CampaignScore> {
  const grouped = await prisma.contribution.groupBy({
    by: ["teamId"],
    where: { campaignId, status: "SUCCESS" },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const byTeam = new Map(
    grouped.map((g) => [g.teamId, { total: g._sum.amount ?? 0, count: g._count._all }])
  );

  const a = byTeam.get(teamAId) ?? { total: 0, count: 0 };
  const b = byTeam.get(teamBId) ?? { total: 0, count: 0 };
  const combinedTotal = a.total + b.total;

  const pct = (n: number) => (combinedTotal === 0 ? 0 : Math.round((n / combinedTotal) * 1000) / 10);

  const teamA: TeamScore = {
    teamId: teamAId,
    total: a.total,
    supporterCount: a.count,
    percentage: pct(a.total),
  };
  const teamB: TeamScore = {
    teamId: teamBId,
    total: b.total,
    supporterCount: b.count,
    percentage: pct(b.total),
  };

  let leaderTeamId: string | null = null;
  if (teamA.total > teamB.total) leaderTeamId = teamA.teamId;
  else if (teamB.total > teamA.total) leaderTeamId = teamB.teamId;

  return {
    teamA,
    teamB,
    combinedTotal,
    leaderTeamId,
    differenceAmount: Math.abs(teamA.total - teamB.total),
  };
}

export async function computeMomentum(campaignId: string, teamId: string, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs);
  const result = await prisma.contribution.aggregate({
    where: { campaignId, teamId, status: "SUCCESS", verifiedAt: { gte: since } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function getTeamLeaderboard(campaignId: string, teamId: string, limit = 10) {
  const rows = await prisma.contribution.groupBy({
    by: ["userId", "displayName", "isAnonymous"],
    where: { campaignId, teamId, status: "SUCCESS" },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  return rows.map((r, i) => ({
    rank: i + 1,
    displayName: r.isAnonymous ? "Anonymous Supporter" : r.displayName,
    amount: r._sum.amount ?? 0,
  }));
}
