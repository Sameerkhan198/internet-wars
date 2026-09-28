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

  // Idempotent under concurrency: many requests can arrive just after endAt.
  // The conditional update (still LIVE) lets exactly one of them finalize;
  // only that one records the CAMPAIGN_END event. Losers just read ENDED.
  const finalizedAt = new Date();
  const won = await prisma.$transaction(async (tx) => {
    const claimed = await tx.campaign.updateMany({
      where: { id: campaign.id, status: "LIVE" },
      data: { status: "ENDED", winnerTeamId: score.leaderTeamId, finalizedAt },
    });
    if (claimed.count !== 1) return false;
    await tx.activityEvent.create({
      data: { campaignId: campaign.id, type: "CAMPAIGN_END", message: "The battle has ended." },
    });
    return true;
  });

  if (!won) {
    const current = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    return { ...campaign, status: current?.status ?? "ENDED" };
  }
  return { ...campaign, status: "ENDED" };
}
