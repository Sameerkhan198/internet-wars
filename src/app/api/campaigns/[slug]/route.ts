import { NextResponse } from "next/server";
import { getCampaignBySlug } from "@/server/campaign";
import { computeCampaignScore, computeMomentum } from "@/server/scoring";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const campaign = await getCampaignBySlug(slug);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const score = await computeCampaignScore(campaign.id, campaign.teamAId!, campaign.teamBId!);
  const [teamAMomentum10m, teamBMomentum10m] = await Promise.all([
    computeMomentum(campaign.id, campaign.teamAId!, 10 * 60 * 1000),
    computeMomentum(campaign.id, campaign.teamBId!, 10 * 60 * 1000),
  ]);

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      description: campaign.description,
      status: campaign.status,
      currency: campaign.currency,
      startAt: campaign.startAt,
      endAt: campaign.endAt,
      minimumContribution: campaign.minimumContribution,
      maximumContribution: campaign.maximumContribution,
      disclaimer: campaign.disclaimer,
      winnerTeamId: campaign.winnerTeamId,
    },
    teamA: campaign.teamA,
    teamB: campaign.teamB,
    score,
    momentum: {
      teamA10m: teamAMomentum10m,
      teamB10m: teamBMomentum10m,
    },
  });
}
