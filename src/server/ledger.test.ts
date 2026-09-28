import { describe, it, expect, beforeEach, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeCampaignScore, computeScoreSeries, getTeamLeaderboard } from "@/server/scoring";
import { initiateContribution, applyWebhookResult } from "@/server/contributions";
import { getCampaignBySlug } from "@/server/campaign";
import { demoProvider, signDemoWebhook } from "@/lib/payments/demoProvider";
import { demoResetStatus } from "@/server/demoMode";
import {
  bootstrapAdmin,
  BootstrapError,
  createSession,
  getAdminForToken,
  hashPassword,
  revokeSession,
  verifyPassword,
  isSameOrigin,
} from "@/server/adminAuth";
import { resetDb, createTestCampaign } from "@/test/dbHelpers";

/**
 * Phase 4 regression suite. Runs against a real PostgreSQL server
 * (npm run test:pg) — the concurrency cases depend on real row locking.
 */

async function signedDelivery(providerOrderId: string, providerTransactionId: string, status: "SUCCESS" | "FAILED") {
  const payload = JSON.stringify({ providerOrderId, providerTransactionId, status });
  const result = await demoProvider.handleWebhook(payload, new Headers({ "x-demo-signature": signDemoWebhook(payload) }));
  return applyWebhookResult({ ...result, status: result.status === "SUCCESS" ? "SUCCESS" : "FAILED", rawBody: payload });
}

async function pendingContribution(amount: number, team: "A" | "B" = "A", name = "Rahul", isAnonymous = false) {
  const { campaign, teamA, teamB } = ctx;
  const { contribution } = await initiateContribution({
    campaign,
    team: team === "A" ? teamA : teamB,
    amount,
    displayName: name,
    isAnonymous,
  });
  const payment = await prisma.payment.findUniqueOrThrow({ where: { contributionId: contribution.id } });
  return { contribution, orderId: payment.providerOrderId! };
}

let ctx: Awaited<ReturnType<typeof createTestCampaign>>;

describe("ledger under concurrency and cross-view consistency", () => {
  beforeEach(async () => {
    await resetDb();
    ctx = await createTestCampaign();
  });
  afterAll(() => prisma.$disconnect());

  it("credits a success exactly once when the same webhook arrives concurrently", async () => {
    const { orderId, contribution } = await pendingContribution(50000);

    // 10 simultaneous deliveries of the identical signed webhook.
    await Promise.all(Array.from({ length: 10 }, () => signedDelivery(orderId, "txn_race", "SUCCESS")));

    const score = await computeCampaignScore(ctx.campaign.id, ctx.teamA.id, ctx.teamB.id);
    expect(score.teamA.total).toBe(50000);
    expect(score.teamA.supporterCount).toBe(1);

    const events = await prisma.activityEvent.count({ where: { contributionId: contribution.id, type: "CONTRIBUTION" } });
    expect(events).toBe(1); // side effects fired once, not per delivery
    expect(await prisma.leaderboardSnapshot.count({ where: { campaignId: ctx.campaign.id } })).toBe(1);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { providerOrderId: orderId } });
    expect(payment.status).toBe("SUCCESS");
  });

  it("does not let a late conflicting webhook flip a settled payment", async () => {
    const { orderId, contribution } = await pendingContribution(20000);
    await signedDelivery(orderId, "txn_1", "SUCCESS");
    await signedDelivery(orderId, "txn_1", "FAILED"); // conflicting replay

    const c = await prisma.contribution.findUniqueOrThrow({ where: { id: contribution.id } });
    expect(c.status).toBe("SUCCESS");
    const score = await computeCampaignScore(ctx.campaign.id, ctx.teamA.id, ctx.teamB.id);
    expect(score.teamA.total).toBe(20000);
  });

  it("finalizes an expired campaign once, even with simultaneous readers", async () => {
    const { orderId } = await pendingContribution(30000, "B");
    await signedDelivery(orderId, "txn_b", "SUCCESS");
    await prisma.campaign.update({ where: { id: ctx.campaign.id }, data: { endAt: new Date(Date.now() - 1000) } });

    const results = await Promise.all(Array.from({ length: 8 }, () => getCampaignBySlug(ctx.campaign.slug)));
    expect(results.every((r) => r?.status === "ENDED")).toBe(true);

    const ends = await prisma.activityEvent.count({ where: { campaignId: ctx.campaign.id, type: "CAMPAIGN_END" } });
    expect(ends).toBe(1);
    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: ctx.campaign.id } });
    expect(c.status).toBe("ENDED");
    expect(c.winnerTeamId).toBe(ctx.teamB.id);
    expect(c.finalizedAt).not.toBeNull();
  });

  it("scoreboard, leaderboard, chart and history all agree and ignore non-SUCCESS rows", async () => {
    const ok1 = await pendingContribution(10000, "A", "Asha");
    const ok2 = await pendingContribution(25000, "A", "Asha");
    const ok3 = await pendingContribution(40000, "B", "Farhan");
    const failed = await pendingContribution(90000, "A", "Ghost");
    await pendingContribution(70000, "B", "Pending"); // never confirmed

    await signedDelivery(ok1.orderId, "t1", "SUCCESS");
    await signedDelivery(ok2.orderId, "t2", "SUCCESS");
    await signedDelivery(ok3.orderId, "t3", "SUCCESS");
    await signedDelivery(failed.orderId, "t4", "FAILED");

    const score = await computeCampaignScore(ctx.campaign.id, ctx.teamA.id, ctx.teamB.id);
    expect(score.teamA.total).toBe(35000);
    expect(score.teamB.total).toBe(40000);

    const boardA = await getTeamLeaderboard(ctx.campaign.id, ctx.teamA.id, 10);
    expect(boardA).toEqual([{ rank: 1, displayName: "Asha", amount: 35000 }]);
    const boardB = await getTeamLeaderboard(ctx.campaign.id, ctx.teamB.id, 10);
    expect(boardB.map((r) => r.displayName)).toEqual(["Farhan"]);

    const series = await computeScoreSeries(ctx.campaign.id, ctx.teamA.id, ctx.teamB.id, ctx.campaign.startAt, ctx.campaign.endAt);
    const last = series[series.length - 1];
    expect(last.a).toBe(score.teamA.total);
    expect(last.b).toBe(score.teamB.total);
    // cumulative series never decreases
    for (let i = 1; i < series.length; i++) {
      expect(series[i].a).toBeGreaterThanOrEqual(series[i - 1].a);
      expect(series[i].b).toBeGreaterThanOrEqual(series[i - 1].b);
    }
  });

  it("never exposes an anonymous supporter's typed name in any stored or public field", async () => {
    const anon = await pendingContribution(15000, "A", "RealNameHere", true);
    await signedDelivery(anon.orderId, "t_anon", "SUCCESS");

    const stored = await prisma.contribution.findUniqueOrThrow({ where: { id: anon.contribution.id } });
    expect(stored.displayName).toBe("Anonymous Supporter");
    const events = await prisma.activityEvent.findMany({ where: { campaignId: ctx.campaign.id } });
    expect(events.some((e) => e.message.includes("RealNameHere"))).toBe(false);
    const board = await getTeamLeaderboard(ctx.campaign.id, ctx.teamA.id, 10);
    expect(JSON.stringify(board)).not.toContain("RealNameHere");
  });
});

describe("demo reset guard", () => {
  const saved = { ...process.env };
  beforeEach(resetDb);
  afterEach(() => {
    process.env.DEMO_MODE = saved.DEMO_MODE;
    process.env.REAL_PAYMENTS_ENABLED = saved.REAL_PAYMENTS_ENABLED;
  });

  it("is blocked unless DEMO_MODE is explicitly true", async () => {
    process.env.DEMO_MODE = "false";
    expect((await demoResetStatus()).allowed).toBe(false);
    delete process.env.DEMO_MODE;
    expect((await demoResetStatus()).allowed).toBe(false);
    process.env.DEMO_MODE = "true";
    expect((await demoResetStatus()).allowed).toBe(true);
  });

  it("is blocked when real payments are enabled, even in demo mode", async () => {
    process.env.DEMO_MODE = "true";
    process.env.REAL_PAYMENTS_ENABLED = "true";
    expect(await demoResetStatus()).toMatchObject({ allowed: false });
  });

  it("is permanently blocked once any non-demo payment exists", async () => {
    process.env.DEMO_MODE = "true";
    const { campaign, teamA } = await createTestCampaign();
    const c = await prisma.contribution.create({
      data: { campaignId: campaign.id, teamId: teamA.id, displayName: "x", amount: 1000, status: "SUCCESS" },
    });
    await prisma.payment.create({ data: { contributionId: c.id, provider: "razorpay", idempotencyKey: "k1", status: "SUCCESS" } });
    expect(await demoResetStatus()).toMatchObject({ allowed: false });
  });
});

describe("admin authentication", () => {
  const saved = { ...process.env };
  beforeEach(resetDb);
  afterEach(() => {
    process.env.INITIAL_ADMIN_EMAIL = saved.INITIAL_ADMIN_EMAIL;
    process.env.ADMIN_PASSWORD = saved.ADMIN_PASSWORD;
  });

  it("hashes with scrypt and verifies only the right password", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batterY", h)).toBe(false);
    expect(await hashPassword("same")).not.toBe(await hashPassword("same")); // salted
  });

  it("sessions: valid until revoked or expired; unknown tokens rejected", async () => {
    const admin = await prisma.adminUser.create({ data: { email: "a@test.dev", passwordHash: await hashPassword("x".repeat(12)) } });
    const { token } = await createSession(admin.id);
    expect((await getAdminForToken(token))?.email).toBe("a@test.dev");

    await revokeSession(token);
    expect(await getAdminForToken(token)).toBeNull();

    const s2 = await createSession(admin.id);
    await prisma.adminSession.updateMany({ where: { revokedAt: null }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await getAdminForToken(s2.token)).toBeNull();

    expect(await getAdminForToken("A".repeat(43))).toBeNull();
    expect(await getAdminForToken("not-a-token")).toBeNull();
  });

  it("bootstrap creates exactly one admin under concurrent attempts, then closes", async () => {
    process.env.INITIAL_ADMIN_EMAIL = "Owner@Example.test";
    process.env.ADMIN_PASSWORD = "setup-secret-value";
    const attempt = () =>
      bootstrapAdmin({ email: "owner@example.test", setupSecret: "setup-secret-value", newPassword: "a-new-strong-password" });

    const results = await Promise.allSettled(Array.from({ length: 5 }, attempt));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.adminUser.count()).toBe(1);
    await expect(attempt()).rejects.toThrow(BootstrapError);
  });

  it("bootstrap rejects wrong email, wrong secret, weak or reused passwords", async () => {
    process.env.INITIAL_ADMIN_EMAIL = "owner@example.test";
    process.env.ADMIN_PASSWORD = "setup-secret-value";
    const base = { email: "owner@example.test", setupSecret: "setup-secret-value", newPassword: "a-new-strong-password" };
    await expect(bootstrapAdmin({ ...base, email: "someone@else.test" })).rejects.toThrow(BootstrapError);
    await expect(bootstrapAdmin({ ...base, setupSecret: "guess" })).rejects.toThrow(BootstrapError);
    await expect(bootstrapAdmin({ ...base, newPassword: "short" })).rejects.toThrow(BootstrapError);
    await expect(bootstrapAdmin({ ...base, newPassword: "setup-secret-value" })).rejects.toThrow(BootstrapError);
    expect(await prisma.adminUser.count()).toBe(0);
  });

  it("origin check accepts same-origin and refuses missing or foreign origins", () => {
    const req = (origin?: string) =>
      new Request("https://internet-wars.vercel.app/api/admin/seed", {
        method: "POST",
        headers: { host: "internet-wars.vercel.app", ...(origin ? { origin } : {}) },
      });
    expect(isSameOrigin(req("https://internet-wars.vercel.app"))).toBe(true);
    expect(isSameOrigin(req("https://evil.example"))).toBe(false);
    expect(isSameOrigin(req())).toBe(false);
  });
});
