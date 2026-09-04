import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider, demoProvider, buildDemoWebhookDelivery } from "@/lib/payments/demoProvider";
import { computeCampaignScore } from "@/server/scoring";
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
}) {
  const { campaign, team, amount, isAnonymous, userId, ipHash } = params;
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
    await deliverDemoWebhook(providerOrderId);
  }

  return { contribution, clientPayload };
}

/**
 * Runs the demo provider's confirmation callback in-process.
 *
 * A real provider calls our webhook endpoint over HTTPS some seconds later.
 * We can't simulate that with a timer: on a serverless host the function is
 * frozen the moment it responds, so a deferred callback would never fire and
 * every contribution would sit PENDING forever. Instead the same signed
 * payload is verified and applied synchronously, through the identical
 * signature-check and idempotency path a real webhook would take. The user
 * still sees a "verifying payment" state because the client polls for status
 * rather than trusting the response.
 */
async function deliverDemoWebhook(providerOrderId: string) {
  const delivery = buildDemoWebhookDelivery(providerOrderId);
  if (!delivery) return;

  const result = await demoProvider.handleWebhook(
    delivery.rawBody,
    new Headers({ "x-demo-signature": delivery.signature })
  );

  await applyWebhookResult({
    providerOrderId: result.providerOrderId,
    providerTransactionId: result.providerTransactionId,
    status: result.status === "SUCCESS" ? "SUCCESS" : "FAILED",
    authentic: result.authentic,
    rawBody: delivery.rawBody,
  });
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
    // Clients pick these up by polling /api/activity/[slug] — see
    // useCampaignPolling. No push mechanism is needed (or reliable across
    // serverless instances), so this is just a plain ledger write.
    await prisma.activityEvent.create({
      data: {
        campaignId: campaign.id,
        type: e.type,
        contributionId: contribution.id,
        message: e.message,
      },
    });
  }

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
