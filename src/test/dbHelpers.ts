import { prisma } from "@/lib/prisma";

export async function resetDb() {
  await prisma.leaderboardSnapshot.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.shareEvent.deleteMany();
  await prisma.rateLimitBucket.deleteMany();
  await prisma.team.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestCampaign(overrides: Partial<{ status: string; endAt: Date }> = {}) {
  const draft = await prisma.campaign.create({
    data: {
      slug: `test-campaign-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: "Test Campaign",
      description: "Test",
      startAt: new Date(Date.now() - 1000 * 60 * 60),
      endAt: overrides.endAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24),
      status: (overrides.status ?? "LIVE") as never,
      minimumContribution: 1000,
      maximumContribution: 10_000_00,
    },
  });

  const teamA = await prisma.team.create({
    data: { campaignId: draft.id, name: "Team A", slug: "team-a", shortName: "A" },
  });
  const teamB = await prisma.team.create({
    data: { campaignId: draft.id, name: "Team B", slug: "team-b", shortName: "B" },
  });

  const campaign = await prisma.campaign.update({
    where: { id: draft.id },
    data: { teamAId: teamA.id, teamBId: teamB.id },
  });

  return { campaign, teamA, teamB };
}
