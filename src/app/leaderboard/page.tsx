import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeCampaignScore, getTeamLeaderboard } from "@/server/scoring";
import { formatINR, formatINRCompact } from "@/lib/money";
import { sideVisual, type SideVisual } from "@/lib/sides";
import Mascot from "@/components/Mascot";
import PageHeader from "@/components/PageHeader";
import StatusPill from "@/components/StatusPill";
import DataUnavailable, { loadOrNull } from "@/components/DataUnavailable";

export const metadata = { title: "Leaderboard — Internet Wars" };
export const dynamic = "force-dynamic";

const LIMIT = 25;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const { campaign: requestedSlug } = await searchParams;

  const data = await loadOrNull("leaderboard", async () => {
    const campaign = requestedSlug
      ? await prisma.campaign.findUnique({ where: { slug: requestedSlug }, include: { teamA: true, teamB: true } })
      : await prisma.campaign.findFirst({
          where: { status: { in: ["LIVE", "PAUSED", "ENDED"] } },
          orderBy: { startAt: "desc" },
          include: { teamA: true, teamB: true },
        });
    if (!campaign || !campaign.teamA || !campaign.teamB) return { campaign: null } as const;

    const [score, rowsA, rowsB] = await Promise.all([
      computeCampaignScore(campaign.id, campaign.teamA.id, campaign.teamB.id),
      getTeamLeaderboard(campaign.id, campaign.teamA.id, LIMIT),
      getTeamLeaderboard(campaign.id, campaign.teamB.id, LIMIT),
    ]);
    return { campaign, score, rowsA, rowsB } as const;
  });

  if (!data) {
    return (
      <main className="flex-1 px-4">
        <DataUnavailable what="The leaderboard" />
      </main>
    );
  }

  if (!data.campaign) {
    return (
      <main className="flex-1 bg-grid">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
          <PageHeader eyebrow="Leaderboard" title="Supporter leaderboard" />
          <div className="panel p-10 text-center text-sm text-muted">
            {requestedSlug ? "That battle doesn't exist." : "No leaderboard yet — the first battle hasn't opened."}
          </div>
        </div>
      </main>
    );
  }

  const { campaign, score, rowsA, rowsB } = data;
  const teamA = campaign.teamA!;
  const teamB = campaign.teamB!;
  const va = sideVisual(teamA.accentTheme, "a");
  const vb = sideVisual(teamB.accentTheme, "b");
  const max = Math.max(1, ...rowsA.map((r) => r.amount), ...rowsB.map((r) => r.amount));

  return (
    <main className="flex-1 bg-terminal">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        <PageHeader
          eyebrow={
            <>
              <StatusPill status={campaign.status} />
              <span>Leaderboard</span>
            </>
          }
          title={
            <>
              <span style={{ color: va.color }}>{teamA.name}</span>
              <span className="text-muted font-normal mx-2 sm:mx-3">/</span>
              <span style={{ color: vb.color }}>{teamB.name}</span>
            </>
          }
          subtitle={`Top ${LIMIT} supporters per side, ranked by verified support.`}
          aside={
            <dl className="grid grid-cols-3 gap-x-6 font-mono text-xs">
              <Stat label="Total support" value={formatINRCompact(score.combinedTotal)} />
              <Stat
                label="Supporters"
                value={(score.teamA.supporterCount + score.teamB.supporterCount).toLocaleString("en-IN")}
              />
              <Stat label="Leader" value={score.leaderTeamId === teamA.id ? teamA.shortName : score.leaderTeamId === teamB.id ? teamB.shortName : "Even"} />
            </dl>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Column
            name={teamA.name}
            shortName={teamA.shortName}
            visual={va}
            total={score.teamA.total}
            share={score.teamA.percentage}
            supporters={score.teamA.supporterCount}
            rows={rowsA}
            max={max}
          />
          <Column
            name={teamB.name}
            shortName={teamB.shortName}
            visual={vb}
            total={score.teamB.total}
            share={score.teamB.percentage}
            supporters={score.teamB.supporterCount}
            rows={rowsB}
            max={max}
          />
        </div>

        <p className="mt-6 font-mono text-[11px] text-muted">
          Only verified contributions count. Anonymous supporters are shown as &ldquo;Anonymous Supporter&rdquo;.{" "}
          <Link href="/history" className="underline underline-offset-2 hover:text-foreground">
            Past battles →
          </Link>
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label !text-[10px]">{label}</dt>
      <dd className="text-sm text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function Column({
  name,
  shortName,
  visual,
  total,
  share,
  supporters,
  rows,
  max,
}: {
  name: string;
  shortName: string;
  visual: SideVisual;
  total: number;
  share: number;
  supporters: number;
  rows: { rank: number; displayName: string; amount: number }[];
  max: number;
}) {
  return (
    <section className="panel" aria-label={`${name} supporters`}>
      <div className="panel-header">
        <span className="flex items-center gap-2" style={{ color: visual.color }}>
          <span aria-hidden="true">{visual.glyph}</span>
          {shortName} supporters
        </span>
        <span className="tabular-nums">{supporters.toLocaleString("en-IN")} total</span>
      </div>

      <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
        <Mascot icon={visual.icon} color={visual.color} label={shortName} className="h-14 w-14 shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold truncate">{name}</div>
          <div className="font-mono text-xs text-muted tabular-nums">
            <span className="text-foreground">{formatINR(total)}</span> · {share.toFixed(1)}% share
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">Be the first person to back this side.</p>
      ) : (
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="label !text-[10px] border-b border-border">
              <th scope="col" className="text-left font-normal px-4 py-2 w-12">Rank</th>
              <th scope="col" className="text-left font-normal px-2 py-2">Supporter</th>
              <th scope="col" className="text-right font-normal px-4 py-2">Support</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rank} className="relative border-b border-border/50 last:border-0">
                <td className="relative px-4 py-2 text-muted tabular-nums">{String(r.rank).padStart(2, "0")}</td>
                <td className="relative px-2 py-2 max-w-0 w-full">
                  <span className="block truncate text-foreground">{r.displayName}</span>
                </td>
                <td className="relative px-4 py-2 text-right tabular-nums font-semibold whitespace-nowrap" style={{ color: visual.color }}>
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 right-0"
                    style={{ width: `${Math.max(4, (r.amount / max) * 100)}%`, background: visual.dim, maxWidth: "100%" }}
                  />
                  <span className="relative">{formatINR(r.amount)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
