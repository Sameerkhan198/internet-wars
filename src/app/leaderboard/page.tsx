import { prisma } from "@/lib/prisma";
import { getTeamLeaderboard } from "@/server/scoring";
import { formatINR } from "@/lib/money";

export const metadata = { title: "Leaderboard — Internet Wars" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const campaign = await prisma.campaign.findFirst({
    where: { status: { in: ["LIVE", "PAUSED", "ENDED"] } },
    orderBy: { startAt: "desc" },
    include: { teamA: true, teamB: true },
  });

  if (!campaign || !campaign.teamA || !campaign.teamB) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-24 text-center text-muted">
        No leaderboard available yet.
      </main>
    );
  }

  const [teamARows, teamBRows] = await Promise.all([
    getTeamLeaderboard(campaign.id, campaign.teamA.id, 25),
    getTeamLeaderboard(campaign.id, campaign.teamB.id, 25),
  ]);

  return (
    <main className="flex-1 mx-auto max-w-5xl w-full px-4 sm:px-6 py-12">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Supporter Leaderboard</h1>
      <p className="text-muted text-sm mb-10">{campaign.title}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <LeaderboardColumn title={campaign.teamA.shortName} accentVar="--team-a" rows={teamARows} />
        <LeaderboardColumn title={campaign.teamB.shortName} accentVar="--team-b" rows={teamBRows} />
      </div>
    </main>
  );
}

function LeaderboardColumn({
  title,
  accentVar,
  rows,
}: {
  title: string;
  accentVar: string;
  rows: { rank: number; displayName: string; amount: number }[];
}) {
  return (
    <div className="rounded-2xl border border-border p-5 bg-background-elevated/40">
      <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: `var(${accentVar})` }}>
        {title} Supporters
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">Be the first person to back this side.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.rank}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-black/20 border border-border/60"
            >
              <span className="flex items-center gap-2">
                <span className="numeric text-muted w-8">#{r.rank}</span>
                <span className="font-medium">{r.displayName}</span>
              </span>
              <span className="numeric font-bold">{formatINR(r.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
