import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/money";
import LogoutButton from "@/components/admin/LogoutButton";
import SeedButton from "@/components/admin/SeedButton";

export const metadata = { title: "Admin — Internet Wars" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [successCount, failedCount, refundedCount, totalShares, sumResult, campaigns, recentTransactions] =
    await Promise.all([
      prisma.contribution.count({ where: { status: "SUCCESS" } }),
      prisma.contribution.count({ where: { status: "FAILED" } }),
      prisma.contribution.count({ where: { status: "REFUNDED" } }),
      prisma.shareEvent.count(),
      prisma.contribution.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true }, _avg: { amount: true } }),
      prisma.campaign.findMany({ include: { teamA: true, teamB: true }, orderBy: { startAt: "desc" } }),
      prisma.contribution.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { team: true },
      }),
    ]);

  const attempts = successCount + failedCount;
  const paymentSuccessRate = attempts === 0 ? 0 : ((successCount / attempts) * 100).toFixed(1);
  const refundRate = successCount === 0 ? 0 : ((refundedCount / successCount) * 100).toFixed(1);

  return (
    <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <h1 className="text-3xl font-black tracking-tight">Admin Overview</h1>
        <div className="flex items-center gap-2">
          <SeedButton />
          <LogoutButton />
        </div>
      </div>

      {campaigns.length === 0 && (
        <div className="rounded-xl border border-border p-6 mb-10 bg-background-elevated/40">
          <div className="font-bold mb-1">No campaign yet</div>
          <p className="text-sm text-muted">
            This database is empty. Use <strong>Load demo data</strong> above to create the demo battle,
            its two teams and a few hundred contributions.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        <Stat label="Verified Contributions" value={successCount.toLocaleString("en-IN")} />
        <Stat label="Total Verified Amount" value={formatINR(sumResult._sum.amount ?? 0)} />
        <Stat label="Avg Contribution" value={formatINR(Math.round(sumResult._avg.amount ?? 0))} />
        <Stat label="Payment Success Rate" value={`${paymentSuccessRate}%`} />
        <Stat label="Failed Payments" value={failedCount.toLocaleString("en-IN")} />
        <Stat label="Refund Rate" value={`${refundRate}%`} />
        <Stat label="Total Shares" value={totalShares.toLocaleString("en-IN")} />
        <Stat label="Campaigns" value={campaigns.length.toString()} />
      </div>

      <h2 className="text-lg font-bold mb-4">Campaigns</h2>
      <div className="rounded-xl border border-border overflow-hidden mb-12">
        <table className="w-full text-sm">
          <thead className="bg-background-elevated text-muted text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Title</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Teams</th>
              <th className="text-left px-4 py-2">Ends</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-2">{c.title}</td>
                <td className="px-4 py-2">{c.status}</td>
                <td className="px-4 py-2 text-muted">
                  {c.teamA?.shortName} vs {c.teamB?.shortName}
                </td>
                <td className="px-4 py-2 text-muted">{c.endAt.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-bold mb-4">Recent Transactions</h2>
      <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background-elevated text-muted text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Supporter</th>
              <th className="text-left px-4 py-2">Team</th>
              <th className="text-left px-4 py-2">Amount</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-2">{t.isAnonymous ? "Anonymous Supporter" : t.displayName}</td>
                <td className="px-4 py-2 text-muted">{t.team.shortName}</td>
                <td className="px-4 py-2 numeric">{formatINR(t.amount)}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-2 text-muted">{t.createdAt.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4 bg-background-elevated/40">
      <div className="text-xs text-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="numeric text-xl font-bold">{value}</div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "text-emerald-400",
  FAILED: "text-red-400",
  PENDING: "text-amber-400",
  PROCESSING: "text-amber-400",
  REFUNDED: "text-blue-400",
  CHARGEBACK: "text-red-500",
  CANCELLED: "text-muted",
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`font-semibold ${STATUS_COLORS[status] ?? ""}`}>{status}</span>;
}
