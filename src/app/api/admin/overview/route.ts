import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [totalContributors, successCount, failedCount, refundedCount, allStatuses, totalShares, sumResult] =
    await Promise.all([
      prisma.contribution.groupBy({ by: ["userId", "displayName"], where: { status: "SUCCESS" } }).then((r) => r.length),
      prisma.contribution.count({ where: { status: "SUCCESS" } }),
      prisma.contribution.count({ where: { status: "FAILED" } }),
      prisma.contribution.count({ where: { status: "REFUNDED" } }),
      prisma.contribution.count(),
      prisma.shareEvent.count(),
      prisma.contribution.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true }, _avg: { amount: true } }),
    ]);

  const paymentAttempts = successCount + failedCount;
  const paymentSuccessRate = paymentAttempts === 0 ? 0 : Math.round((successCount / paymentAttempts) * 1000) / 10;
  const refundRate = successCount === 0 ? 0 : Math.round((refundedCount / successCount) * 1000) / 10;

  const campaigns = await prisma.campaign.findMany({
    select: { id: true, title: true, slug: true, status: true },
  });

  return NextResponse.json({
    totals: {
      totalContributors,
      successfulContributions: successCount,
      failedContributions: failedCount,
      refundedContributions: refundedCount,
      allContributionAttempts: allStatuses,
      totalShares,
      totalVerifiedAmount: sumResult._sum.amount ?? 0,
      averageContribution: Math.round(sumResult._avg.amount ?? 0),
      paymentSuccessRate,
      refundRate,
    },
    campaigns,
  });
}
