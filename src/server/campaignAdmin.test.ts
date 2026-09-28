import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  changeCampaignStatus,
  createCampaign,
  updateCampaign,
  CampaignAdminError,
  type CampaignInput,
} from "@/server/campaignAdmin";
import { getCampaignBySlug } from "@/server/campaign";
import { initiateContribution, applyWebhookResult } from "@/server/contributions";
import { demoProvider, signDemoWebhook } from "@/lib/payments/demoProvider";
import { computeCampaignScore } from "@/server/scoring";
import { resetDb } from "@/test/dbHelpers";

const HOUR = 60 * 60 * 1000;

function input(over: Partial<CampaignInput> = {}): CampaignInput {
  return {
    title: "Tea vs Coffee",
    description: "",
    startAt: new Date(Date.now() + HOUR),
    endAt: new Date(Date.now() + 48 * HOUR),
    minimumRupees: 10,
    maximumRupees: 1000,
    sideA: { name: "Tea", shortName: "TEA", theme: "amber" },
    sideB: { name: "Coffee", shortName: "COFFEE", theme: "orange" },
    ...over,
  };
}

async function support(campaignId: string, amount: number) {
  const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { teamA: true } });
  const { contribution } = await initiateContribution({ campaign: c, team: c.teamA!, amount, displayName: "Asha", isAnonymous: false });
  const p = await prisma.payment.findUniqueOrThrow({ where: { contributionId: contribution.id } });
  const payload = JSON.stringify({ providerOrderId: p.providerOrderId, providerTransactionId: `t_${contribution.id}`, status: "SUCCESS" });
  const r = await demoProvider.handleWebhook(payload, new Headers({ "x-demo-signature": signDemoWebhook(payload) }));
  await applyWebhookResult({ ...r, status: "SUCCESS", rawBody: payload });
}

describe("admin campaign management", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("creates a DRAFT with both sides wired and slugs derived", async () => {
    const c = await createCampaign(input());
    const full = await prisma.campaign.findUniqueOrThrow({ where: { id: c.id }, include: { teamA: true, teamB: true } });
    expect(full.status).toBe("DRAFT");
    expect(full.slug).toBe("tea-vs-coffee");
    expect(full.teamA?.accentTheme).toBe("amber");
    expect(full.teamB?.slug).toBe("coffee");
    expect(full.minimumContribution).toBe(1000);
    const again = await createCampaign(input());
    expect(again.slug).toBe("tea-vs-coffee-2");
  });

  it("drafts are not public and reject contributions", async () => {
    const c = await createCampaign(input());
    const full = await prisma.campaign.findUniqueOrThrow({ where: { id: c.id }, include: { teamA: true } });
    await expect(
      initiateContribution({ campaign: full, team: full.teamA!, amount: 5000, displayName: "x", isAnonymous: false })
    ).rejects.toThrow();
  });

  it("allows only one active battle, even when two starts race", async () => {
    const a = await createCampaign(input({ title: "Android vs iPhone" }));
    const b = await createCampaign(input({ title: "Tea vs Coffee" }));
    const results = await Promise.allSettled([changeCampaignStatus(a.id, "start"), changeCampaignStatus(b.id, "start")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.campaign.count({ where: { status: { in: ["LIVE", "PAUSED"] } } })).toBe(1);

    // A paused battle still blocks another from starting or resuming.
    const live = await prisma.campaign.findFirstOrThrow({ where: { status: "LIVE" } });
    const other = live.id === a.id ? b : a;
    await changeCampaignStatus(live.id, "pause");
    await expect(changeCampaignStatus(other.id, "start")).rejects.toThrow(CampaignAdminError);
  });

  it("close finalizes once, picks the leader, and never touches contribution rows", async () => {
    const c = await createCampaign(input());
    await changeCampaignStatus(c.id, "start");
    await support(c.id, 5000);
    await support(c.id, 2500);
    const before = await prisma.contribution.findMany({ where: { campaignId: c.id }, orderBy: { id: "asc" } });

    const closed = await changeCampaignStatus(c.id, "close");
    expect(closed.status).toBe("ENDED");
    expect(closed.winnerTeamId).toBe(closed.teamAId);
    await expect(changeCampaignStatus(c.id, "close")).rejects.toThrow(CampaignAdminError);
    expect(await prisma.activityEvent.count({ where: { campaignId: c.id, type: "CAMPAIGN_END" } })).toBe(1);

    const after = await prisma.contribution.findMany({ where: { campaignId: c.id }, orderBy: { id: "asc" } });
    expect(after).toEqual(before);
    const score = await computeCampaignScore(c.id, closed.teamAId!, closed.teamBId!);
    expect(score.teamA.total).toBe(7500);

    // Closed battles are read-only.
    await expect(updateCampaign(c.id, input({ title: "Rewritten history" }))).rejects.toThrow(CampaignAdminError);
  });

  it("live edits change presentation only; locked fields are ignored", async () => {
    const c = await createCampaign(input());
    await changeCampaignStatus(c.id, "start");
    await updateCampaign(c.id, {
      title: "Tea vs Coffee — final week",
      description: "d",
      endAt: new Date(Date.now() + 72 * HOUR),
      sideA: { name: "Chai", theme: "cyan", shortName: "HACK" },
      sideB: { name: "Coffee", theme: "orange" },
      minimumRupees: 1, // not part of the live schema: ignored
    });
    const full = await prisma.campaign.findUniqueOrThrow({ where: { id: c.id }, include: { teamA: true } });
    expect(full.title).toBe("Tea vs Coffee — final week");
    expect(full.teamA?.name).toBe("Chai");
    expect(full.teamA?.shortName).toBe("TEA");
    expect(full.minimumContribution).toBe(1000);
    await expect(
      updateCampaign(c.id, { title: "x".repeat(10), description: "", endAt: new Date(Date.now() - HOUR), sideA: { name: "Tea", theme: "bull" }, sideB: { name: "Coffee", theme: "bear" } })
    ).rejects.toThrow(CampaignAdminError);
  });

  it("validates input: end after start, max >= min, distinct short names", async () => {
    await expect(createCampaign(input({ endAt: new Date(Date.now() - HOUR) }))).rejects.toThrow();
    expect(await prisma.campaign.count()).toBe(0);
    const { campaignInputSchema } = await import("@/server/campaignAdmin");
    expect(campaignInputSchema.safeParse({ ...input(), endAt: new Date(Date.now() - HOUR) }).success).toBe(false);
    expect(campaignInputSchema.safeParse({ ...input(), minimumRupees: 500, maximumRupees: 10 }).success).toBe(false);
    expect(
      campaignInputSchema.safeParse({ ...input(), sideB: { name: "Tea 2", shortName: "tea", theme: "bear" } }).success
    ).toBe(false);
  });

  it("a scheduled battle opens itself once its start time passes — unless another is active", async () => {
    const s = await createCampaign(input());
    await changeCampaignStatus(s.id, "schedule");
    await prisma.campaign.update({ where: { id: s.id }, data: { startAt: new Date(Date.now() - 1000) } });

    const blocker = await createCampaign(input({ title: "Blocker" }));
    await changeCampaignStatus(blocker.id, "start");
    expect((await getCampaignBySlug(s.slug))?.status).toBe("SCHEDULED");

    await changeCampaignStatus(blocker.id, "close");
    const opened = await getCampaignBySlug(s.slug);
    expect(opened?.status).toBe("LIVE");
    expect(await prisma.activityEvent.count({ where: { campaignId: s.id, type: "CAMPAIGN_START" } })).toBe(1);
  });
});
