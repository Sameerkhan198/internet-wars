import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.campaignSlug || !body?.channel) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({ where: { slug: body.campaignSlug } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.shareEvent.create({
    data: { campaignId: campaign.id, channel: String(body.channel).slice(0, 30) },
  });

  return NextResponse.json({ ok: true });
}
