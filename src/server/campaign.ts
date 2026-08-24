import { prisma } from "@/lib/prisma";

export async function getCampaignBySlug(slug: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: { teamA: true, teamB: true },
  });
  if (!campaign) return null;
  return maybeFinalize(campaign);
}

/**
 * Server-controlled campaign end: if a LIVE campaign's endAt has passed,
 * finalize it (freeze scoreboard, compute winner) before returning it.
 * The client never decides when a campaign ends.
 */
async function maybeFinalize<T extends { id: string; status: string; endAt: Date; teamAId: string | null; teamBId: string | null }>(
  campaign: T
): Promise<T> {
  if (campaign.status !== "LIVE") return campaign;
  if (new Date() <= campaign.endAt) return campaign;

  const { computeCampaignScore } = await import("@/server/scoring");
  const score = await computeCampaignScore(campaign.id, campaign.teamAId!, campaign.teamBId!);

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "ENDED",
      winnerTeamId: score.leaderTeamId,
      finalizedAt: new Date(),
    },
  });

  await prisma.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: "CAMPAIGN_END",
      message: "The battle has ended.",
    },
  });

  return { ...campaign, status: "ENDED" };
}
