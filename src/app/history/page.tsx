import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeCampaignScore } from "@/server/scoring";
import { formatINRCompact } from "@/lib/money";
import { sideVisual } from "@/lib/sides";
import Mascot from "@/components/Mascot";
import PageHeader from "@/components/PageHeader";
import StatusPill from "@/components/StatusPill";
import DataUnavailable, { loadOrNull } from "@/components/DataUnavailable";

export const metadata = { title: "Battle History — Internet Wars" };
export const dynamic = "force-dynamic";

/** Fixed IST so server output is stable. */
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
}

export default async function HistoryPage() {
  const rows = await loadOrNull("history", async () => {
    const campaigns = await prisma.campaign.findMany({
      // Drafts are admin-only; everything else is public record.
      where: { status: { not: "DRAFT" } },
      orderBy: { startAt: "desc" },
      include: { teamA: true, teamB: true },
    });
    return Promise.all(
      campaigns
        .filter((c) => c.teamA && c.teamB)
        .map(async (c) => ({ campaign: c, score: await computeCampaignScore(c.id, c.teamAId!, c.teamBId!) }))
    );
  });

  return (
    <main className="flex-1 bg-grid">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        <PageHeader
          eyebrow="Battle history"
          title="Every Internet War"
          subtitle="Past and present battles. Totals are verified support only."
          aside={rows ? <span className="label">{rows.length} battle{rows.length === 1 ? "" : "s"}</span> : undefined}
        />

        {!rows ? (
          <DataUnavailable what="Battle history" />
        ) : rows.length === 0 ? (
          <div className="panel p-10 text-center text-sm text-muted">No battles yet. The first one is coming soon.</div>
        ) : (
          <ol className="space-y-4">
            {rows.map(({ campaign, score }) => {
              const teamA = campaign.teamA!;
              const teamB = campaign.teamB!;
              const va = sideVisual(teamA.accentTheme, "a");
              const vb = sideVisual(teamB.accentTheme, "b");
              const settled = campaign.status === "ENDED";
              const winner = !settled
                ? null
                : campaign.winnerTeamId === teamA.id
                  ? { team: teamA, v: va }
                  : campaign.winnerTeamId === teamB.id
                    ? { team: teamB, v: vb }
                    : null;
              const empty = score.combinedTotal === 0;
              const aPct = empty ? 50 : score.teamA.percentage;

              return (
                <li key={campaign.id} className="panel">
                  <div className="panel-header flex-wrap">
                    <span className="flex items-center gap-2 min-w-0">
                      <StatusPill status={campaign.status} />
                      <span className="text-foreground truncate normal-case tracking-normal font-sans text-xs font-semibold">
                        {campaign.title}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {fmtDate(campaign.startAt)} → {fmtDate(campaign.endAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 p-4 sm:p-5 items-center">
                    <Side name={teamA.name} shortName={teamA.shortName} color={va.color} glyph={va.glyph} total={score.teamA.total} supporters={score.teamA.supporterCount} share={score.teamA.percentage} empty={empty} />

                    <div className="text-center">
                      {winner ? (
                        <div className="flex flex-col items-center gap-1">
                          <Mascot icon={winner.v.icon} color={winner.v.color} label={winner.team.shortName} className="h-12 w-12" />
                          <span className="label !text-[10px]">Result</span>
                          <span className="font-mono text-xs font-bold" style={{ color: winner.v.color }}>
                            {winner.team.shortName} took #1
                          </span>
                        </div>
                      ) : settled ? (
                        <span className="font-mono text-xs font-bold text-muted">Tie</span>
                      ) : (
                        <span className="font-mono text-xs font-bold tracking-[0.3em] text-muted">VS</span>
                      )}
                    </div>

                    <Side name={teamB.name} shortName={teamB.shortName} color={vb.color} glyph={vb.glyph} total={score.teamB.total} supporters={score.teamB.supporterCount} share={score.teamB.percentage} empty={empty} alignRight />
                  </div>

                  <div className="px-4 sm:px-5 pb-4">
                    <div
                      className="flex h-2 rounded-sm overflow-hidden bg-white/5"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={aPct}
                      aria-label={`${teamA.shortName} share of verified support`}
                    >
                      {!empty && (
                        <>
                          <div style={{ width: `${aPct}%`, background: va.color }} />
                          <div style={{ width: `${100 - aPct}%`, background: vb.color }} />
                        </>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted">
                      <span>
                        {(score.teamA.supporterCount + score.teamB.supporterCount).toLocaleString("en-IN")} supporters ·{" "}
                        {formatINRCompact(score.combinedTotal)} total
                      </span>
                      <span className="flex gap-4">
                        {campaign.status === "LIVE" && (
                          <Link href="/" className="text-foreground hover:underline underline-offset-2">
                            Open battle →
                          </Link>
                        )}
                        <Link href={`/leaderboard?campaign=${encodeURIComponent(campaign.slug)}`} className="hover:text-foreground hover:underline underline-offset-2">
                          Leaderboard →
                        </Link>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}

function Side({
  name,
  shortName,
  color,
  glyph,
  total,
  supporters,
  share,
  empty,
  alignRight,
}: {
  name: string;
  shortName: string;
  color: string;
  glyph: string;
  total: number;
  supporters: number;
  share: number;
  empty: boolean;
  alignRight?: boolean;
}) {
  return (
    <div className={`min-w-0 ${alignRight ? "sm:text-right" : ""}`}>
      <div className="font-mono text-xs font-semibold" style={{ color }}>
        <span aria-hidden="true">{glyph}</span> {shortName}
      </div>
      <div className="text-sm text-muted truncate">{name}</div>
      <div className="numeric text-2xl font-semibold mt-1">{formatINRCompact(total)}</div>
      <div className="font-mono text-[11px] text-muted tabular-nums">
        {empty ? "—" : `${share.toFixed(1)}%`} · {supporters.toLocaleString("en-IN")} supporters
      </div>
    </div>
  );
}
