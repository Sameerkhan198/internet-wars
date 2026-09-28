import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamLeaderboard } from "@/server/scoring";
import { PUBLIC_STATUSES, withUnavailable } from "@/server/apiGuard";

export const GET = withUnavailable(
  "leaderboard",
  async (_request: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const campaign = await prisma.campaign.findFirst({
      where: { slug, status: { in: [...PUBLIC_STATUSES] } },
      include: { teamA: true, teamB: true },
    });
    if (!campaign || !campaign.teamAId || !campaign.teamBId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [teamA, teamB] = await Promise.all([
      getTeamLeaderboard(campaign.id, campaign.teamAId, 20),
      getTeamLeaderboard(campaign.id, campaign.teamBId, 20),
    ]);

    return NextResponse.json({
      teamA: { team: campaign.teamA, supporters: teamA },
      teamB: { team: campaign.teamB, supporters: teamB },
    });
  }
);
