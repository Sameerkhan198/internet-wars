import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeCampaignScore } from "@/server/scoring";
import { initiateContribution, applyWebhookResult, ContributionError } from "@/server/contributions";
import { demoProvider, signDemoWebhook } from "@/lib/payments/demoProvider";
import { resetDb, createTestCampaign } from "@/test/dbHelpers";

async function deliverWebhook(providerOrderId: string, providerTransactionId: string, status: "SUCCESS" | "FAILED") {
  const payload = JSON.stringify({ providerOrderId, providerTransactionId, status });
  const signature = signDemoWebhook(payload);
  const result = await demoProvider.handleWebhook(payload, new Headers({ "x-demo-signature": signature }));
  await applyWebhookResult({ ...result, status: result.status === "SUCCESS" ? "SUCCESS" : "FAILED", rawBody: payload });
  return result;
}

describe("contribution + payment ledger", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("never lets a pending contribution affect the public scoreboard", async () => {
    const { campaign, teamA, teamB } = await createTestCampaign();
    await initiateContribution({
      campaign,
      team: teamA,
      amount: 50000,
      displayName: "Rahul",
      isAnonymous: false,
      baseUrl: "http://localhost:3000",
    });

    const score = await computeCampaignScore(campaign.id, teamA.id, teamB.id);
    expect(score.teamA.total).toBe(0);
    expect(score.combinedTotal).toBe(0);
  });

  it("adds a contribution to the scoreboard only after a verified webhook", async () => {
    const { campaign, teamA, teamB } = await createTestCampaign();
    const { contribution } = await initiateContribution({
      campaign,
      team: teamA,
      amount: 50000,
      displayName: "Rahul",
      isAnonymous: false,
      baseUrl: "http://localhost:3000",
    });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { contributionId: contribution.id } });

    await deliverWebhook(payment.providerOrderId!, "txn_1", "SUCCESS");

    const score = await computeCampaignScore(campaign.id, teamA.id, teamB.id);
    expect(score.teamA.total).toBe(50000);
    expect(score.teamA.supporterCount).toBe(1);

    const updated = await prisma.contribution.findUniqueOrThrow({ where: { id: contribution.id } });
    expect(updated.status).toBe("SUCCESS");
  });

  it("does not double-count the same webhook delivered twice", async () => {
    const { campaign, teamA, teamB } = await createTestCampaign();
    const { contribution } = await initiateContribution({
      campaign,
      team: teamA,
      amount: 50000,
      displayName: "Rahul",
      isAnonymous: false,
      baseUrl: "http://localhost:3000",
    });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { contributionId: contribution.id } });

    await deliverWebhook(payment.providerOrderId!, "txn_dup", "SUCCESS");
    await deliverWebhook(payment.providerOrderId!, "txn_dup", "SUCCESS"); // replayed delivery

    const score = await computeCampaignScore(campaign.id, teamA.id, teamB.id);
    expect(score.teamA.total).toBe(50000); // not 100000

    const contributions = await prisma.contribution.count({ where: { campaignId: campaign.id } });
    expect(contributions).toBe(1); // no duplicate rows created either
  });

  it("rejects a webhook with an invalid signature and leaves the scoreboard untouched", async () => {
    const { campaign, teamA, teamB } = await createTestCampaign();
    const { contribution } = await initiateContribution({
      campaign,
      team: teamA,
      amount: 50000,
      displayName: "Rahul",
      isAnonymous: false,
      baseUrl: "http://localhost:3000",
    });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { contributionId: contribution.id } });

    const payload = JSON.stringify({
      providerOrderId: payment.providerOrderId,
      providerTransactionId: "forged_txn",
      status: "SUCCESS",
    });
    const result = await demoProvider.handleWebhook(payload, new Headers({ "x-demo-signature": "not-a-real-signature" }));
    expect(result.authentic).toBe(false);

    await expect(
      applyWebhookResult({ ...result, status: "SUCCESS", rawBody: payload })
    ).rejects.toThrow(ContributionError);

    const score = await computeCampaignScore(campaign.id, teamA.id, teamB.id);
    expect(score.teamA.total).toBe(0);

    const updated = await prisma.contribution.findUniqueOrThrow({ where: { id: contribution.id } });
    expect(updated.status).toBe("PENDING");
  });

  it("marks a FAILED webhook outcome as failed without affecting the scoreboard", async () => {
    const { campaign, teamA, teamB } = await createTestCampaign();
    const { contribution } = await initiateContribution({
      campaign,
      team: teamA,
      amount: 50000,
      displayName: "Rahul",
      isAnonymous: false,
      baseUrl: "http://localhost:3000",
    });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { contributionId: contribution.id } });

    await deliverWebhook(payment.providerOrderId!, "txn_failed", "FAILED");

    const score = await computeCampaignScore(campaign.id, teamA.id, teamB.id);
    expect(score.teamA.total).toBe(0);

    const updated = await prisma.contribution.findUniqueOrThrow({ where: { id: contribution.id } });
    expect(updated.status).toBe("FAILED");
  });

  it("rejects contributions below the minimum or above the maximum", async () => {
    const { campaign, teamA } = await createTestCampaign();
    await expect(
      initiateContribution({
        campaign,
        team: teamA,
        amount: 1, // below minimumContribution of 1000
        displayName: "Rahul",
        isAnonymous: false,
        baseUrl: "http://localhost:3000",
      })
    ).rejects.toThrow(ContributionError);

    await expect(
      initiateContribution({
        campaign,
        team: teamA,
        amount: 999_999_999, // above maximumContribution
        displayName: "Rahul",
        isAnonymous: false,
        baseUrl: "http://localhost:3000",
      })
    ).rejects.toThrow(ContributionError);
  });

  it("rejects contributions to a campaign that is not LIVE", async () => {
    const { campaign, teamA } = await createTestCampaign({ status: "PAUSED" });
    await expect(
      initiateContribution({
        campaign,
        team: teamA,
        amount: 50000,
        displayName: "Rahul",
        isAnonymous: false,
        baseUrl: "http://localhost:3000",
      })
    ).rejects.toThrow(ContributionError);
  });

  it("hides display names for anonymous contributions and shows Anonymous Supporter on the leaderboard", async () => {
    const { campaign, teamA } = await createTestCampaign();
    const { contribution } = await initiateContribution({
      campaign,
      team: teamA,
      amount: 50000,
      displayName: "SecretIdentity",
      isAnonymous: true,
      baseUrl: "http://localhost:3000",
    });
    expect(contribution.displayName).toBe("Anonymous Supporter");

    const payment = await prisma.payment.findUniqueOrThrow({ where: { contributionId: contribution.id } });
    await deliverWebhook(payment.providerOrderId!, "txn_anon", "SUCCESS");

    const { getTeamLeaderboard } = await import("@/server/scoring");
    const board = await getTeamLeaderboard(campaign.id, teamA.id, 10);
    expect(board[0].displayName).toBe("Anonymous Supporter");
    expect(board.some((r) => r.displayName === "SecretIdentity")).toBe(false);
  });
});
