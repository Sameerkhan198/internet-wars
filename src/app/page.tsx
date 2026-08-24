import { prisma } from "@/lib/prisma";
import { getCampaignBySlug } from "@/server/campaign";
import { computeCampaignScore, computeMomentum, getTeamLeaderboard } from "@/server/scoring";
import BattleView from "@/components/BattleView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const liveCampaign = await prisma.campaign.findFirst({
    where: { status: { in: ["LIVE", "PAUSED"] } },
    orderBy: { startAt: "desc" },
  });
  const fallback = liveCampaign ?? (await prisma.campaign.findFirst({ orderBy: { startAt: "desc" } }));

  if (!fallback) {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">No battle is live yet</h1>
          <p className="text-muted text-sm">Check back soon — the next Internet War is coming.</p>
        </div>
      </main>
    );
  }

  const campaign = await getCampaignBySlug(fallback.slug);
  if (!campaign) return null;

  const [score, teamA10m, teamB10m, leaderboard] = await Promise.all([
    computeCampaignScore(campaign.id, campaign.teamAId!, campaign.teamBId!),
    computeMomentum(campaign.id, campaign.teamAId!, 10 * 60 * 1000),
    computeMomentum(campaign.id, campaign.teamBId!, 10 * 60 * 1000),
    Promise.all([
      getTeamLeaderboard(campaign.id, campaign.teamAId!, 5),
      getTeamLeaderboard(campaign.id, campaign.teamBId!, 5),
    ]),
  ]);

  return (
    <BattleView
      campaign={{
        id: campaign.id,
        slug: campaign.slug,
        title: campaign.title,
        status: campaign.status,
        startAt: campaign.startAt.toISOString(),
        endAt: campaign.endAt.toISOString(),
        minimumContribution: campaign.minimumContribution,
        maximumContribution: campaign.maximumContribution,
        currency: campaign.currency,
        winnerTeamId: campaign.winnerTeamId,
      }}
      teamA={campaign.teamA!}
      teamB={campaign.teamB!}
      initialScore={score}
      initialMomentum={{ teamA10m, teamB10m }}
      initialLeaderboard={{ teamA: leaderboard[0], teamB: leaderboard[1] }}
    />
  );
}
