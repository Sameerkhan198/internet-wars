import Link from "next/link";
import { formatINRCompact } from "@/lib/money";
import type { LeaderboardRow, TeamDTO } from "@/lib/types";

export default function LeaderboardPreview({
  teamA,
  teamB,
  leaderboard,
}: {
  teamA: TeamDTO;
  teamB: TeamDTO;
  leaderboard: { teamA: LeaderboardRow[]; teamB: LeaderboardRow[] };
}) {
  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Top Supporters</h2>
        <Link href="/leaderboard" className="text-xs text-muted hover:text-foreground underline underline-offset-2">
          View full leaderboard →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MiniList team={teamA} rows={leaderboard.teamA} accentVar="--team-a" />
        <MiniList team={teamB} rows={leaderboard.teamB} accentVar="--team-b" />
      </div>
    </section>
  );
}

function MiniList({ team, rows, accentVar }: { team: TeamDTO; rows: LeaderboardRow[]; accentVar: string }) {
  return (
    <div className="rounded-xl border border-border p-4 bg-background-elevated/60">
      <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: `var(${accentVar})` }}>
        {team.shortName} Supporters
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Be the first person to back this side.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.rank} className="flex items-center justify-between text-sm">
              <span className="text-muted">
                #{r.rank} <span className="text-foreground">{r.displayName}</span>
              </span>
              <span className="numeric font-semibold">{formatINRCompact(r.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
