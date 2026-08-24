import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const campaign = await prisma.campaign.findUnique({ where: { slug }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 25), 100);
  const events = await prisma.activityEvent.findMany({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, message: true, createdAt: true },
  });

  return NextResponse.json({ events });
}
