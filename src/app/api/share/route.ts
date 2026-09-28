import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/server/rateLimit";
import { PUBLIC_STATUSES, withUnavailable } from "@/server/apiGuard";
import { SHARE_CHANNELS } from "@/lib/share";

/** Records that someone shared (channel + campaign only — no identity). */
export const POST = withUnavailable("share", async (request: Request) => {
  const rate = await checkRateLimit(`share:${getClientIp(request)}`, 20, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { campaignSlug?: unknown; channel?: unknown } | null;
  const channel = typeof body?.channel === "string" ? body.channel : "";
  if (typeof body?.campaignSlug !== "string" || !(SHARE_CHANNELS as readonly string[]).includes(channel)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { slug: body.campaignSlug, status: { in: [...PUBLIC_STATUSES] } },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.shareEvent.create({ data: { campaignId: campaign.id, channel } });
  return NextResponse.json({ ok: true });
});
