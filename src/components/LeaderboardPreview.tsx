import Link from "next/link";
import { formatINRCompact } from "@/lib/money";
import type { LeaderboardRow, TeamDTO } from "@/lib/types";

/** Top supporters, mirrored bull (left) vs bear (right) with depth bars. */
export default function LeaderboardPreview({
  teamA,
  teamB,
  leaderboard,
}: {
  teamA: TeamDTO;
  teamB: TeamDTO;
  leaderboard: { teamA: LeaderboardRow[]; teamB: LeaderboardRow[] };
}) {
  const max = Math.max(1, ...leaderboard.teamA.map((r) => r.amount), ...leaderboard.teamB.map((r) => r.amount));

  return (
    <section className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="text-foreground">Top supporters</span>
        <Link href="/leaderboard" className="hover:text-foreground transition-colors normal-case tracking-normal">
          Full leaderboard →
        </Link>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border flex-1">
        <Book team={teamA} rows={leaderboard.teamA} side="bull" max={max} />
        <Book team={teamB} rows={leaderboard.teamB} side="bear" max={max} />
      </div>
    </section>
  );
}

function Book({
  team,
  rows,
  side,
  max,
}: {
  team: TeamDTO;
  rows: LeaderboardRow[];
  side: "bull" | "bear";
  max: number;
}) {
  const isBull = side === "bull";
  const color = isBull ? "var(--bull)" : "var(--bear)";
  const depth = isBull ? "rgba(22,199,132,0.14)" : "rgba(246,70,93,0.14)";

  return (
    <div className="min-w-0">
      <div className={`flex justify-between px-3 py-2 label border-b border-border ${isBull ? "" : "flex-row-reverse"}`}>
        <span style={{ color }}>{team.shortName}</span>
        <span>Amount</span>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted">Be the first person to back this side.</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={r.rank} className="relative">
              <div
                className={`absolute inset-y-0 ${isBull ? "right-0" : "left-0"}`}
                style={{ width: `${(r.amount / max) * 100}%`, background: depth }}
              />
              <div className={`relative flex items-center justify-between gap-2 px-3 py-1.5 font-mono text-xs ${isBull ? "" : "flex-row-reverse"}`}>
                <span className="truncate">
                  <span className="text-muted mr-1.5">{String(r.rank).padStart(2, "0")}</span>
                  <span className="text-foreground">{r.displayName}</span>
                </span>
                <span className="tabular-nums font-semibold shrink-0" style={{ color }}>
                  {formatINRCompact(r.amount)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
