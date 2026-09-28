import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatINR, formatINRCompact } from "@/lib/money";
import { formatIst } from "@/lib/ist";
import { sideVisual } from "@/lib/sides";
import LogoutButton from "@/components/admin/LogoutButton";
import SeedButton from "@/components/admin/SeedButton";
import StatusPill from "@/components/StatusPill";
import { requireAdminPage } from "@/server/adminAuth";
import { DEMO_RESET_PHRASE, demoResetStatus } from "@/server/demoMode";
import { computeCampaignScore } from "@/server/scoring";

export const metadata = { title: "Admin — Internet Wars" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  // Server-side check on every render — the proxy cookie check is only a pre-filter.
  const admin = await requireAdminPage();
  const reset = await demoResetStatus();
  const [successCount, failedCount, refundedCount, totalShares, sumResult, campaigns, recentTransactions] =
    await Promise.all([
      prisma.contribution.count({ where: { status: "SUCCESS" } }),
      prisma.contribution.count({ where: { status: "FAILED" } }),
      prisma.contribution.count({ where: { status: "REFUNDED" } }),
      prisma.shareEvent.count(),
      prisma.contribution.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true }, _avg: { amount: true } }),
      prisma.campaign.findMany({ include: { teamA: true, teamB: true }, orderBy: { startAt: "desc" } }),
      prisma.contribution.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { team: true } }),
    ]);

  const scored = await Promise.all(
    campaigns.map(async (c) => ({
      c,
      score: c.teamAId && c.teamBId ? await computeCampaignScore(c.id, c.teamAId, c.teamBId) : null,
    }))
  );

  const attempts = successCount + failedCount;
  const paymentSuccessRate = attempts === 0 ? 0 : ((successCount / attempts) * 100).toFixed(1);
  const refundRate = successCount === 0 ? 0 : ((refundedCount / successCount) * 100).toFixed(1);

  return (
    <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-10 space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label mb-1">Admin</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Control room</h1>
          <p className="font-mono text-xs text-muted mt-1">Signed in as {admin.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/campaigns/new" className="min-h-10 inline-flex items-center px-4 rounded font-mono text-xs font-bold uppercase tracking-wider bg-foreground text-background">
            + New battle
          </Link>
          <LogoutButton />
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Verified contributions" value={successCount.toLocaleString("en-IN")} />
        <Stat label="Total verified amount" value={formatINR(sumResult._sum.amount ?? 0)} />
        <Stat label="Average contribution" value={formatINR(Math.round(sumResult._avg.amount ?? 0))} />
        <Stat label="Payment success rate" value={`${paymentSuccessRate}%`} />
        <Stat label="Failed payments" value={failedCount.toLocaleString("en-IN")} />
        <Stat label="Refund rate" value={`${refundRate}%`} />
        <Stat label="Shares recorded" value={totalShares.toLocaleString("en-IN")} />
        <Stat label="Battles" value={campaigns.length.toString()} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="text-foreground">Battles</span>
          <span>Totals are verified (SUCCESS) only</span>
        </div>
        {scored.length === 0 ? (
          <p className="p-6 text-sm text-muted">No battles yet. Create one with “New battle”.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="label !text-[10px] border-b border-border">
                  <th scope="col" className="text-left font-normal px-4 py-2">Battle</th>
                  <th scope="col" className="text-left font-normal px-4 py-2">Status</th>
                  <th scope="col" className="text-right font-normal px-4 py-2">Side A</th>
                  <th scope="col" className="text-right font-normal px-4 py-2">Side B</th>
                  <th scope="col" className="text-left font-normal px-4 py-2">Window (IST)</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Manage</span></th>
                </tr>
              </thead>
              <tbody>
                {scored.map(({ c, score }) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{c.title}</td>
                    <td className="px-4 py-2.5"><StatusPill status={c.status} /></td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                      <span style={{ color: sideVisual(c.teamA?.accentTheme, "a").color }}>{c.teamA?.shortName}</span>{" "}
                      {score ? `${formatINRCompact(score.teamA.total)} · ${score.teamA.supporterCount}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                      <span style={{ color: sideVisual(c.teamB?.accentTheme, "b").color }}>{c.teamB?.shortName}</span>{" "}
                      {score ? `${formatINRCompact(score.teamB.total)} · ${score.teamB.supporterCount}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted whitespace-nowrap">
                      {formatIst(c.startAt)} → {formatIst(c.endAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/campaigns/${c.id}`} className="font-mono text-xs underline underline-offset-2 hover:text-foreground">
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="text-foreground">Recent transactions</span>
          <span>Last 15, all statuses</span>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="label !text-[10px] border-b border-border">
                <th scope="col" className="text-left font-normal px-4 py-2">Supporter</th>
                <th scope="col" className="text-left font-normal px-4 py-2">Side</th>
                <th scope="col" className="text-right font-normal px-4 py-2">Amount</th>
                <th scope="col" className="text-left font-normal px-4 py-2">Status</th>
                <th scope="col" className="text-left font-normal px-4 py-2">Time (IST)</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2">{t.isAnonymous ? "Anonymous Supporter" : t.displayName}</td>
                  <td className="px-4 py-2 text-muted font-mono text-xs">{t.team.shortName}</td>
                  <td className="px-4 py-2 numeric text-right">{formatINR(t.amount)}</td>
                  <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-2 text-muted font-mono text-xs whitespace-nowrap">{formatIst(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel border-danger/40">
        <div className="panel-header">
          <span className="text-danger">Danger zone</span>
          <span>Demo environments only</span>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-xs text-muted">
            Deletes every battle, contribution and activity event and loads a fresh demo battle. Only possible while demo
            mode is on and the ledger holds no real payments.
          </p>
          <SeedButton allowed={reset.allowed} reason={reset.allowed ? undefined : reset.reason} phrase={DEMO_RESET_PHRASE} />
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <div className="label !text-[10px] mb-1">{label}</div>
      <div className="numeric text-lg font-semibold">{value}</div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "var(--bull)",
  FAILED: "var(--bear)",
  PENDING: "var(--signal)",
  PROCESSING: "var(--signal)",
  REFUNDED: "var(--muted)",
  CHARGEBACK: "var(--bear)",
  CANCELLED: "var(--muted)",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="font-mono text-xs font-semibold" style={{ color: STATUS_COLORS[status] }}>
      {status}
    </span>
  );
}
