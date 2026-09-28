import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_STATUSES, withUnavailable } from "@/server/apiGuard";

export const GET = withUnavailable(
  "activity",
  async (request: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const campaign = await prisma.campaign.findFirst({
      where: { slug, status: { in: [...PUBLIC_STATUSES] } },
      select: { id: true },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const requested = Number(new URL(request.url).searchParams.get("limit") ?? 25);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 100) : 25;
    const events = await prisma.activityEvent.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, type: true, message: true, createdAt: true },
    });

    return NextResponse.json({ events });
  }
);
