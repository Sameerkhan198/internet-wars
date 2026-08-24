import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeCampaignScore } from "@/server/scoring";
import { resetDb, createTestCampaign } from "@/test/dbHelpers";

describe("computeCampaignScore", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("returns zero percentages safely when there are no contributions", async () => {
    const { campaign, teamA, teamB } = await createTestCampaign();
    const score = await computeCampaignScore(campaign.id, teamA.id, teamB.id);
    expect(score.teamA.percentage).toBe(0);
    expect(score.teamB.percentage).toBe(0);
    expect(score.leaderTeamId).toBeNull();
    expect(score.combinedTotal).toBe(0);
  });

  it("only counts SUCCESS contributions toward totals", async () => {
    const { campaign, teamA, teamB } = await createTestCampaign();
    await prisma.contribution.createMany({
      data: [
        { campaignId: campaign.id, teamId: teamA.id, displayName: "a", amount: 10000, status: "SUCCESS" },
        { campaignId: campaign.id, teamId: teamA.id, displayName: "b", amount: 50000, status: "PENDING" },
        { campaignId: campaign.id, teamId: teamA.id, displayName: "c", amount: 99999, status: "FAILED" },
        { campaignId: campaign.id, teamId: teamB.id, displayName: "d", amount: 5000, status: "SUCCESS" },
        { campaignId: campaign.id, teamId: teamB.id, displayName: "e", amount: 20000, status: "REFUNDED" },
      ],
    });

    const score = await computeCampaignScore(campaign.id, teamA.id, teamB.id);
    expect(score.teamA.total).toBe(10000);
    expect(score.teamA.supporterCount).toBe(1);
    expect(score.teamB.total).toBe(5000);
    expect(score.combinedTotal).toBe(15000);
    expect(score.leaderTeamId).toBe(teamA.id);
    expect(score.differenceAmount).toBe(5000);
  });

  it("computes percentages to one decimal place", async () => {
    const { campaign, teamA, teamB } = await createTestCampaign();
    await prisma.contribution.createMany({
      data: [
        { campaignId: campaign.id, teamId: teamA.id, displayName: "a", amount: 2000, status: "SUCCESS" },
        { campaignId: campaign.id, teamId: teamB.id, displayName: "b", amount: 1000, status: "SUCCESS" },
      ],
    });
    const score = await computeCampaignScore(campaign.id, teamA.id, teamB.id);
    expect(score.teamA.percentage).toBeCloseTo(66.7, 1);
    expect(score.teamB.percentage).toBeCloseTo(33.3, 1);
    expect(score.teamA.percentage + score.teamB.percentage).toBeCloseTo(100, 0);
  });
});
