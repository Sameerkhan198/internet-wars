import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contributeSchema } from "@/lib/validation";
import { initiateContribution, ContributionError } from "@/server/contributions";
import { checkRateLimit, getClientIp, hashIp } from "@/server/rateLimit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = await checkRateLimit(`contribute:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = contributeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { campaignSlug, teamSlug, amount, displayName, isAnonymous } = parsed.data;

  const campaign = await prisma.campaign.findUnique({ where: { slug: campaignSlug } });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  const team = await prisma.team.findUnique({
    where: { campaignId_slug: { campaignId: campaign.id, slug: teamSlug } },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  try {
    const { contribution, clientPayload } = await initiateContribution({
      campaign,
      team,
      amount,
      displayName,
      isAnonymous,
      ipHash: hashIp(ip),
    });

    return NextResponse.json({
      contributionId: contribution.id,
      status: contribution.status,
      payment: clientPayload,
    });
  } catch (err) {
    if (err instanceof ContributionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("contribute error", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
