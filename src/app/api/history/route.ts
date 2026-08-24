import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCampaignScore } from "@/server/scoring";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { startAt: "desc" },
    include: { teamA: true, teamB: true },
  });

  const withScores = await Promise.all(
    campaigns.map(async (c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      status: c.status,
      startAt: c.startAt,
      endAt: c.endAt,
      teamA: c.teamA,
      teamB: c.teamB,
      winnerTeamId: c.winnerTeamId,
      score: await computeCampaignScore(c.id, c.teamAId!, c.teamBId!),
    }))
  );

  return NextResponse.json({ campaigns: withScores });
}
