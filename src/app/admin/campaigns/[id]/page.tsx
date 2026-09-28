import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/server/adminAuth";
import { ACTIONS_BY_STATUS } from "@/server/campaignAdmin";
import { computeCampaignScore } from "@/server/scoring";
import { formatINR } from "@/lib/money";
import { formatIst } from "@/lib/ist";
import { isSideThemeKey, sideVisual } from "@/lib/sides";
import StatusPill from "@/components/StatusPill";
import CampaignForm from "@/components/admin/CampaignForm";
import CampaignActions from "@/components/admin/CampaignActions";

export const metadata = { title: "Battle — Admin" };
export const dynamic = "force-dynamic";

export default async function CampaignAdminPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id }, include: { teamA: true, teamB: true } });
  if (!c || !c.teamA || !c.teamB) notFound();

  const [score, attempts] = await Promise.all([
    computeCampaignScore(c.id, c.teamA.id, c.teamB.id),
    prisma.contribution.groupBy({ by: ["status"], where: { campaignId: c.id }, _count: { _all: true } }),
  ]);
  const va = sideVisual(c.teamA.accentTheme, "a");
  const vb = sideVisual(c.teamB.accentTheme, "b");
  const editable = c.status !== "ENDED" && c.status !== "CANCELLED";
  const live = c.status === "LIVE" || c.status === "PAUSED";

  return (
    <main className="flex-1 mx-auto max-w-5xl w-full px-4 sm:px-6 py-10 space-y-6">
      <div>
        <Link href="/admin" className="label hover:text-foreground">
          ← Admin
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{c.title}</h1>
          <StatusPill status={c.status} />
        </div>
        <p className="font-mono text-xs text-muted mt-1">
          /{c.slug} · {formatIst(c.startAt)} → {formatIst(c.endAt)} IST
          {c.finalizedAt && ` · finalized ${formatIst(c.finalizedAt)}`}
        </p>
      </div>

      <section className="panel">
        <div className="panel-header">
          <span className="text-foreground">Verified totals</span>
          <span>From the ledger</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 font-mono text-sm">
          <Stat label={c.teamA.shortName} color={va.color} value={formatINR(score.teamA.total)} sub={`${score.teamA.supporterCount} supporters`} />
          <Stat label={c.teamB.shortName} color={vb.color} value={formatINR(score.teamB.total)} sub={`${score.teamB.supporterCount} supporters`} />
          <Stat label="Combined" value={formatINR(score.combinedTotal)} sub={score.leaderTeamId ? `Leader: ${score.leaderTeamId === c.teamA.id ? c.teamA.shortName : c.teamB.shortName}` : "Even"} />
          <Stat label="Attempts" value={String(attempts.reduce((n, a) => n + a._count._all, 0))} sub={attempts.map((a) => `${a.status.toLowerCase()} ${a._count._all}`).join(" · ") || "none"} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="text-foreground">Status</span>
          <span>One battle active at a time</span>
        </div>
        <div className="p-4">
          <CampaignActions campaignId={c.id} actions={ACTIONS_BY_STATUS[c.status] ?? []} />
        </div>
      </section>

      {editable && (
        <section className="panel">
          <div className="panel-header">
            <span className="text-foreground">Edit</span>
            <span>{live ? "Presentation only" : "All fields"}</span>
          </div>
          <div className="p-4 sm:p-6">
            <CampaignForm
              mode="edit"
              campaignId={c.id}
              live={live}
              initial={{
                title: c.title,
                description: c.description,
                startAt: c.startAt.toISOString(),
                endAt: c.endAt.toISOString(),
                minimumRupees: Math.round(c.minimumContribution / 100),
                maximumRupees: Math.round(c.maximumContribution / 100),
                sideA: { name: c.teamA.name, shortName: c.teamA.shortName, theme: isSideThemeKey(c.teamA.accentTheme) ? c.teamA.accentTheme : va.theme },
                sideB: { name: c.teamB.name, shortName: c.teamB.shortName, theme: isSideThemeKey(c.teamB.accentTheme) ? c.teamB.accentTheme : vb.theme },
              }}
            />
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="label !text-[10px]" style={color ? { color } : undefined}>
        {label}
      </div>
      <div className="text-base text-foreground tabular-nums truncate">{value}</div>
      <div className="text-[11px] text-muted truncate">{sub}</div>
    </div>
  );
}
