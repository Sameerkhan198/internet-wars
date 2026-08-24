import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider, scheduleDemoWebhookDelivery } from "@/lib/payments/demoProvider";
import { computeCampaignScore } from "@/server/scoring";
import { publish } from "@/server/realtime";
import { sanitizeDisplayName } from "@/lib/validation";
import type { Campaign, Team } from "@prisma/client";

const MILESTONE_STEP = 100_000_00; // ₹1,00,000 in paise

export class ContributionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

/**
 * Creates a PENDING contribution + payment order. Nothing here affects the
 * public scoreboard — that only happens once a webhook is verified.
 */
export async function initiateContribution(params: {
  campaign: Campaign;
  team: Team;
  amount: number;
  displayName: string;
  isAnonymous: boolean;
  userId?: string;
  ipHash?: string;
  baseUrl: string;
}) {
  const { campaign, team, amount, isAnonymous, userId, ipHash, baseUrl } = params;
  const displayName = isAnonymous ? "Anonymous Supporter" : sanitizeDisplayName(params.displayName);

  if (campaign.status !== "LIVE") {
    throw new ContributionError("This campaign is not currently accepting contributions.", "CAMPAIGN_NOT_LIVE");
  }
  if (new Date() > campaign.endAt) {
    throw new ContributionError("This campaign has ended.", "CAMPAIGN_ENDED");
  }
  if (amount < campaign.minimumContribution) {
    throw new ContributionError(
      `Minimum contribution is ${campaign.minimumContribution / 100} ${campaign.currency}.`,
      "AMOUNT_TOO_LOW"
    );
  }
  if (amount > campaign.maximumContribution) {
    throw new ContributionError(
      `Maximum contribution is ${campaign.maximumContribution / 100} ${campaign.currency}.`,
      "AMOUNT_TOO_HIGH"
    );
  }

  const idempotencyKey = crypto.randomUUID();

  const contribution = await prisma.contribution.create({
    data: {
      campaignId: campaign.id,
      teamId: team.id,
      userId,
      displayName,
      isAnonymous,
      amount,
      currency: campaign.currency,
      status: "PENDING",
      ipHash,
    },
  });

  const provider = getPaymentProvider();
  const { providerOrderId, clientPayload } = await provider.createPayment({
    contributionId: contribution.id,
    amount,
    currency: campaign.currency,
    idempotencyKey,
  });

  await prisma.payment.create({
    data: {
      contributionId: contribution.id,
      provider: "demo",
      providerOrderId,
      status: "PENDING",
      idempotencyKey,
    },
  });

  if (process.env.DEMO_MODE === "true") {
    scheduleDemoWebhookDelivery(providerOrderId, baseUrl);
  }

  return { contribution, clientPayload };
}

/**
 * Applies a verified webhook result to a payment/contribution. Idempotent:
 * calling this twice with the same providerTransactionId only applies the
 * effect once, because we only act while the payment is still PENDING and we
 * transition it atomically inside the same transaction that reads it.
 */
export async function applyWebhookResult(input: {
  providerOrderId: string;
  providerTransactionId: string;
  status: "SUCCESS" | "FAILED";
  authentic: boolean;
  rawBody: string;
}) {
  if (!input.authentic) {
    throw new ContributionError("Webhook signature verification failed.", "INVALID_SIGNATURE");
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { providerOrderId: input.providerOrderId },
      include: { contribution: { include: { campaign: true, team: true } } },
    });
    if (!payment) return null;

    // Already processed — ignore replayed/duplicate webhook deliveries.
    if (payment.status !== "PENDING") {
      return { alreadyProcessed: true as const, contribution: payment.contribution };
    }

    const newStatus = input.status === "SUCCESS" ? "SUCCESS" : "FAILED";

    // Snapshot the score BEFORE this contribution is applied, so we can detect
    // lead changes and milestone crossings caused specifically by this event.
    const before = await computeCampaignScore(
      payment.contribution.campaign.id,
      payment.contribution.campaign.teamAId!,
      payment.contribution.campaign.teamBId!
    );

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        providerTransactionId: input.providerTransactionId,
        rawWebhookPayload: input.rawBody,
        verifiedAt: new Date(),
      },
    });

    const contribution = await tx.contribution.update({
      where: { id: payment.contributionId },
      data: { status: newStatus, verifiedAt: new Date() },
      include: { campaign: true, team: true },
    });

    return { alreadyProcessed: false as const, contribution, before };
  });

  if (!outcome) return;
  if (outcome.alreadyProcessed) return;

  const { contribution, before } = outcome;
  if (contribution.status !== "SUCCESS") return;

  await onContributionSucceeded(contribution.campaign, contribution.team, contribution, before);
}

async function onContributionSucceeded(
  campaign: Campaign,
  team: Team,
  contribution: { id: string; amount: number; displayName: string; isAnonymous: boolean },
  before: { leaderTeamId: string | null; combinedTotal: number }
) {
  const previousLeader = before.leaderTeamId;
  const previousCombined = before.combinedTotal;

  const score = await computeCampaignScore(campaign.id, campaign.teamAId!, campaign.teamBId!);

  const who = contribution.isAnonymous ? "Someone" : contribution.displayName;
  const events: { type: "CONTRIBUTION" | "LEAD_CHANGE" | "MILESTONE" | "LARGE_SUPPORT"; message: string }[] = [
    { type: "CONTRIBUTION", message: `${who} backed ${team.shortName} +₹${(contribution.amount / 100).toLocaleString("en-IN")}` },
  ];

  if (score.leaderTeamId && score.leaderTeamId !== previousLeader && previousLeader !== null) {
    events.push({ type: "LEAD_CHANGE", message: `${team.shortName} just took the lead!` });
  }

  if (contribution.amount >= 500000) {
    events.push({ type: "LARGE_SUPPORT", message: `${who} made a big move — ₹${(contribution.amount / 100).toLocaleString("en-IN")} on ${team.shortName}!` });
  }

  const prevMilestone = Math.floor(previousCombined / MILESTONE_STEP);
  const newMilestone = Math.floor(score.combinedTotal / MILESTONE_STEP);
  if (newMilestone > prevMilestone) {
    events.push({ type: "MILESTONE", message: `The battle just crossed ₹${(newMilestone * MILESTONE_STEP / 100).toLocaleString("en-IN")} combined!` });
  }

  for (const e of events) {
    const saved = await prisma.activityEvent.create({
      data: {
        campaignId: campaign.id,
        type: e.type,
        contributionId: contribution.id,
        message: e.message,
      },
    });
    publish(campaign.id, {
      type: "ACTIVITY",
      campaignId: campaign.id,
      id: saved.id,
      eventType: e.type,
      message: e.message,
      createdAt: saved.createdAt.toISOString(),
    });
  }

  publish(campaign.id, {
    type: "SCORE_UPDATE",
    campaignId: campaign.id,
    teamATotal: score.teamA.total,
    teamBTotal: score.teamB.total,
    teamAPercentage: score.teamA.percentage,
    teamBPercentage: score.teamB.percentage,
    teamASupporters: score.teamA.supporterCount,
    teamBSupporters: score.teamB.supporterCount,
    leaderTeamId: score.leaderTeamId,
    differenceAmount: score.differenceAmount,
  });

  await prisma.leaderboardSnapshot.create({
    data: {
      campaignId: campaign.id,
      teamATotal: score.teamA.total,
      teamBTotal: score.teamB.total,
      teamASupporters: score.teamA.supporterCount,
      teamBSupporters: score.teamB.supporterCount,
    },
  });
}
