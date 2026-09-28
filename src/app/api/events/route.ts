import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EVENT_SCHEMAS, type EventName } from "@/lib/analyticsEvents";
import { checkRateLimit, getClientIp } from "@/server/rateLimit";
import { PUBLIC_STATUSES } from "@/server/apiGuard";

const envelope = z.object({
  name: z.enum(Object.keys(EVENT_SCHEMAS) as [EventName, ...EventName[]]),
  props: z.unknown(),
  campaignSlug: z.string().max(80).optional(),
  sessionId: z.string().regex(/^[0-9a-f-]{36}$|^no-storage$/),
});

/**
 * Collects first-party analytics events. Only allow-listed names and
 * properties are stored (see lib/analyticsEvents). No IP is stored — it is
 * used transiently for rate limiting only. Always answers 204 so the client
 * never retries or surfaces errors; invalid events are simply dropped.
 */
export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(`events:${getClientIp(request)}`, 120, 60_000);
    if (!rate.allowed) return new NextResponse(null, { status: 204 });

    const parsed = envelope.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new NextResponse(null, { status: 204 });
    const { name, campaignSlug, sessionId } = parsed.data;
    const props = EVENT_SCHEMAS[name].safeParse(parsed.data.props);
    if (!props.success) return new NextResponse(null, { status: 204 });

    const campaign = campaignSlug
      ? await prisma.campaign.findFirst({ where: { slug: campaignSlug, status: { in: [...PUBLIC_STATUSES] } }, select: { id: true } })
      : null;

    await prisma.analyticsEvent.create({
      data: { name, sessionId, campaignId: campaign?.id ?? null, props: JSON.stringify(props.data) },
    });
  } catch (err) {
    console.error("[events] dropped:", err instanceof Error ? err.message.split("\n")[0] : err);
  }
  return new NextResponse(null, { status: 204 });
}
