import { prisma } from "@/lib/prisma";
import { getCampaignBySlug } from "@/server/campaign";
import { computeCampaignScore, computeMomentum, computeScoreSeries, getTeamLeaderboard } from "@/server/scoring";
import BattleView from "@/components/BattleView";
import DataUnavailable, { loadOrNull } from "@/components/DataUnavailable";

export const dynamic = "force-dynamic";

/** The battle shown on the home page: live/paused first, else the most recent public one. */
async function pickCampaignSlug() {
  const current =
    (await prisma.campaign.findFirst({ where: { status: { in: ["LIVE", "PAUSED"] } }, orderBy: { startAt: "desc" } })) ??
    (await prisma.campaign.findFirst({ where: { status: "SCHEDULED" }, orderBy: { startAt: "asc" } })) ??
    (await prisma.campaign.findFirst({ where: { status: { in: ["ENDED", "CANCELLED"] } }, orderBy: { endAt: "desc" } }));
  return current?.slug ?? null;
}

export default async function Home() {
  const data = await loadOrNull("home", async () => {
    const slug = await pickCampaignSlug();
    if (!slug) return { campaign: null } as const;
    const campaign = await getCampaignBySlug(slug);
    if (!campaign || !campaign.teamA || !campaign.teamB) return { campaign: null } as const;

    const [score, teamA10m, teamB10m, leaderboard, series] = await Promise.all([
      computeCampaignScore(campaign.id, campaign.teamA.id, campaign.teamB.id),
      computeMomentum(campaign.id, campaign.teamA.id, 10 * 60 * 1000),
      computeMomentum(campaign.id, campaign.teamB.id, 10 * 60 * 1000),
      Promise.all([getTeamLeaderboard(campaign.id, campaign.teamA.id, 5), getTeamLeaderboard(campaign.id, campaign.teamB.id, 5)]),
      computeScoreSeries(campaign.id, campaign.teamA.id, campaign.teamB.id, campaign.startAt, campaign.endAt),
    ]);
    return { campaign, score, teamA10m, teamB10m, leaderboard, series } as const;
  });

  if (!data) {
    return (
      <main className="flex-1 px-4">
        <DataUnavailable what="The battle" />
      </main>
    );
  }

  if (!data.campaign) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 bg-grid">
        <div className="panel max-w-md w-full">
          <div className="panel-header">
            <span className="text-foreground">Standby</span>
            <span>No active battle</span>
          </div>
          <div className="p-8 text-center">
            <h1 className="text-xl font-bold mb-2">No battle is live yet</h1>
            <p className="text-muted text-sm">Check back soon — the next Internet War is coming.</p>
          </div>
        </div>
      </main>
    );
  }

  const { campaign, score, teamA10m, teamB10m, leaderboard, series } = data;
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
      initialSeries={series}
    />
  );
}
