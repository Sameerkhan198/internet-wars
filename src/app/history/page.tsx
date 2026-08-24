import { prisma } from "@/lib/prisma";
import { computeCampaignScore } from "@/server/scoring";
import { formatINRCompact } from "@/lib/money";

export const metadata = { title: "Battle History — Internet Wars" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  LIVE: "Live",
  PAUSED: "Paused",
  ENDED: "Ended",
  CANCELLED: "Cancelled",
};

export default async function HistoryPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { startAt: "desc" },
    include: { teamA: true, teamB: true },
  });

  const withScores = await Promise.all(
    campaigns
      .filter((c) => c.teamA && c.teamB)
      .map(async (c) => ({
        campaign: c,
        score: await computeCampaignScore(c.id, c.teamAId!, c.teamBId!),
      }))
  );

  return (
    <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-12">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Battle History</h1>
      <p className="text-muted text-sm mb-10">Every Internet War, past and present.</p>

      <div className="space-y-4">
        {withScores.map(({ campaign, score }) => (
          <div key={campaign.id} className="rounded-2xl border border-border p-5 bg-background-elevated/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-muted">{campaign.title}</span>
              <span
                className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                  campaign.status === "LIVE" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-muted"
                }`}
              >
                {STATUS_LABEL[campaign.status] ?? campaign.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs" style={{ color: "var(--team-a)" }}>
                  {campaign.teamA?.shortName}
                  {campaign.winnerTeamId === campaign.teamAId && " 🏆"}
                </div>
                <div className="numeric text-xl font-bold">{formatINRCompact(score.teamA.total)}</div>
                <div className="text-xs text-muted">{score.teamA.supporterCount.toLocaleString("en-IN")} supporters</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: "var(--team-b)" }}>
                  {campaign.teamB?.shortName}
                  {campaign.winnerTeamId === campaign.teamBId && " 🏆"}
                </div>
                <div className="numeric text-xl font-bold">{formatINRCompact(score.teamB.total)}</div>
                <div className="text-xs text-muted">{score.teamB.supporterCount.toLocaleString("en-IN")} supporters</div>
              </div>
            </div>
          </div>
        ))}
        {withScores.length === 0 && (
          <p className="text-muted text-sm text-center py-16">No previous battles yet.</p>
        )}
      </div>
    </main>
  );
}
