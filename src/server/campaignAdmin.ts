import { z } from "zod";
import type { Campaign, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIDE_THEMES } from "@/lib/sides";
import { computeCampaignScore } from "@/server/scoring";

/**
 * Admin campaign management. Invariants:
 *  - At most ONE campaign is LIVE or PAUSED at any time (checked under an
 *    advisory lock inside the transaction that changes status).
 *  - Contribution rows are never modified here. Scores stay ledger-derived.
 *  - What can be edited depends on status: DRAFT/SCHEDULED fully; LIVE/PAUSED
 *    only presentation + end time (not into the past); ENDED/CANCELLED never.
 */

export class CampaignAdminError extends Error {}

const ACTIVE = ["LIVE", "PAUSED"] as const;
const themeKeys = Object.keys(SIDE_THEMES) as [keyof typeof SIDE_THEMES, ...(keyof typeof SIDE_THEMES)[]];

const sideSchema = z.object({
  name: z.string().trim().min(2, "Side name is too short").max(60),
  shortName: z
    .string()
    .trim()
    .min(2, "Short name is too short")
    .max(12, "Short name must be 12 characters or fewer")
    .regex(/^[A-Za-z0-9 &+.-]+$/, "Short name: letters, numbers and & + . - only"),
  theme: z.enum(themeKeys),
});

export const campaignInputSchema = z
  .object({
    title: z.string().trim().min(4, "Title is too short").max(120),
    description: z.string().trim().max(1000).default(""),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    minimumRupees: z.coerce.number().int().min(1, "Minimum must be at least ₹1").max(1_000_000),
    maximumRupees: z.coerce.number().int().min(1).max(10_000_000),
    sideA: sideSchema,
    sideB: sideSchema,
  })
  .refine((v) => v.endAt > v.startAt, { message: "End time must be after the start time", path: ["endAt"] })
  .refine((v) => v.maximumRupees >= v.minimumRupees, { message: "Maximum must be at least the minimum", path: ["maximumRupees"] })
  .refine((v) => v.sideA.shortName.toLowerCase() !== v.sideB.shortName.toLowerCase(), {
    message: "The two sides need different short names",
    path: ["sideB", "shortName"],
  });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

/** Presentation-only edits allowed while a battle is running. */
export const liveEditSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().max(1000).default(""),
  endAt: z.coerce.date(),
  sideA: sideSchema.pick({ name: true, theme: true }),
  sideB: sideSchema.pick({ name: true, theme: true }),
});

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueCampaignSlug(tx: Prisma.TransactionClient, title: string) {
  const base = slugify(title) || "battle";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await tx.campaign.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  throw new CampaignAdminError("Couldn't find a free URL for this title — try a different one.");
}

async function lockCampaigns(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('iw_campaign_status'))`;
}

async function assertNoOtherActive(tx: Prisma.TransactionClient, exceptId: string) {
  const other = await tx.campaign.findFirst({
    where: { status: { in: [...ACTIVE] }, id: { not: exceptId } },
    select: { title: true },
  });
  if (other) throw new CampaignAdminError(`"${other.title}" is already running or paused. Close it first — only one battle can be active.`);
}

export async function createCampaign(raw: CampaignInput | unknown): Promise<Campaign> {
  // Validates itself too — callers other than the API route get the same rules.
  const input = campaignInputSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const slug = await uniqueCampaignSlug(tx, input.title);
    const draft = await tx.campaign.create({
      data: {
        slug,
        title: input.title,
        description: input.description,
        startAt: input.startAt,
        endAt: input.endAt,
        status: "DRAFT",
        minimumContribution: input.minimumRupees * 100,
        maximumContribution: input.maximumRupees * 100,
      },
    });
    const teamA = await tx.team.create({
      data: { campaignId: draft.id, name: input.sideA.name, shortName: input.sideA.shortName, slug: slugify(input.sideA.shortName) || "side-a", accentTheme: input.sideA.theme },
    });
    let slugB = slugify(input.sideB.shortName) || "side-b";
    if (slugB === teamA.slug) slugB = `${slugB}-b`;
    const teamB = await tx.team.create({
      data: { campaignId: draft.id, name: input.sideB.name, shortName: input.sideB.shortName, slug: slugB, accentTheme: input.sideB.theme },
    });
    return tx.campaign.update({ where: { id: draft.id }, data: { teamAId: teamA.id, teamBId: teamB.id } });
  });
}

export async function updateCampaign(id: string, raw: unknown): Promise<Campaign> {
  return prisma.$transaction(async (tx) => {
    await lockCampaigns(tx);
    const c = await tx.campaign.findUnique({ where: { id }, include: { teamA: true, teamB: true } });
    if (!c || !c.teamA || !c.teamB) throw new CampaignAdminError("Campaign not found.");

    if (c.status === "ENDED" || c.status === "CANCELLED") {
      throw new CampaignAdminError("Closed battles are part of the public record and can't be edited.");
    }

    if (c.status === "LIVE" || c.status === "PAUSED") {
      const v = liveEditSchema.parse(raw);
      if (v.endAt <= new Date()) throw new CampaignAdminError("The end time can't be in the past. Use Close to end the battle now.");
      await tx.team.update({ where: { id: c.teamA.id }, data: { name: v.sideA.name, accentTheme: v.sideA.theme } });
      await tx.team.update({ where: { id: c.teamB.id }, data: { name: v.sideB.name, accentTheme: v.sideB.theme } });
      return tx.campaign.update({ where: { id }, data: { title: v.title, description: v.description, endAt: v.endAt } });
    }

    // DRAFT / SCHEDULED: nothing has been contributed yet, everything is editable.
    const v = campaignInputSchema.parse(raw);
    if (c.status === "SCHEDULED" && v.startAt <= new Date()) {
      throw new CampaignAdminError("A scheduled battle's start time must be in the future (or use Start now).");
    }
    await tx.team.update({
      where: { id: c.teamA.id },
      data: { name: v.sideA.name, shortName: v.sideA.shortName, accentTheme: v.sideA.theme },
    });
    await tx.team.update({
      where: { id: c.teamB.id },
      data: { name: v.sideB.name, shortName: v.sideB.shortName, accentTheme: v.sideB.theme },
    });
    return tx.campaign.update({
      where: { id },
      data: {
        title: v.title,
        description: v.description,
        startAt: v.startAt,
        endAt: v.endAt,
        minimumContribution: v.minimumRupees * 100,
        maximumContribution: v.maximumRupees * 100,
      },
    });
  });
}

export type CampaignAction = "schedule" | "unschedule" | "start" | "pause" | "resume" | "close" | "cancel";

/** Which actions make sense from each status (used by API and UI). */
export const ACTIONS_BY_STATUS: Record<string, CampaignAction[]> = {
  DRAFT: ["schedule", "start"],
  SCHEDULED: ["start", "unschedule", "cancel"],
  LIVE: ["pause", "close"],
  PAUSED: ["resume", "close"],
  ENDED: [],
  CANCELLED: [],
};

export async function changeCampaignStatus(id: string, action: CampaignAction): Promise<Campaign> {
  return prisma.$transaction(async (tx) => {
    await lockCampaigns(tx);
    const c = await tx.campaign.findUnique({ where: { id } });
    if (!c) throw new CampaignAdminError("Campaign not found.");
    if (!ACTIONS_BY_STATUS[c.status]?.includes(action)) {
      throw new CampaignAdminError(`Can't ${action} a campaign that is ${c.status.toLowerCase()}.`);
    }
    if (!c.teamAId || !c.teamBId) throw new CampaignAdminError("This campaign has no sides configured.");
    const now = new Date();

    switch (action) {
      case "schedule":
        if (c.startAt <= now) throw new CampaignAdminError("Set a start time in the future to schedule, or use Start now.");
        if (c.endAt <= c.startAt) throw new CampaignAdminError("End time must be after the start time.");
        return tx.campaign.update({ where: { id }, data: { status: "SCHEDULED" } });

      case "unschedule":
        return tx.campaign.update({ where: { id }, data: { status: "DRAFT" } });

      case "cancel":
        return tx.campaign.update({ where: { id }, data: { status: "CANCELLED", finalizedAt: now } });

      case "start": {
        await assertNoOtherActive(tx, id);
        if (c.endAt <= now) throw new CampaignAdminError("The end time has already passed — edit it first.");
        const updated = await tx.campaign.update({
          where: { id },
          data: { status: "LIVE", startAt: c.startAt > now ? now : c.startAt },
        });
        await tx.activityEvent.create({ data: { campaignId: id, type: "CAMPAIGN_START", message: "The battle is open." } });
        return updated;
      }

      case "pause":
        return tx.campaign.update({ where: { id }, data: { status: "PAUSED" } });

      case "resume":
        await assertNoOtherActive(tx, id);
        if (c.endAt <= now) throw new CampaignAdminError("The end time has passed — close the battle instead.");
        return tx.campaign.update({ where: { id }, data: { status: "LIVE" } });

      case "close": {
        // Same conditional claim as automatic finalization: exactly one close.
        const score = await computeCampaignScore(id, c.teamAId, c.teamBId, tx);
        const claimed = await tx.campaign.updateMany({
          where: { id, status: { in: [...ACTIVE] } },
          data: { status: "ENDED", winnerTeamId: score.leaderTeamId, finalizedAt: now, endAt: c.endAt < now ? c.endAt : now },
        });
        if (claimed.count !== 1) throw new CampaignAdminError("This battle was already closed.");
        await tx.activityEvent.create({ data: { campaignId: id, type: "CAMPAIGN_END", message: "The battle has ended." } });
        return tx.campaign.findUniqueOrThrow({ where: { id } });
      }
    }
  });
}

/**
 * Server-controlled start of a SCHEDULED battle once its start time passes —
 * the counterpart of automatic finalization. Only starts if nothing else is
 * running; otherwise it stays SCHEDULED for an admin to resolve.
 */
export async function maybeActivateScheduled(id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await lockCampaigns(tx);
    const c = await tx.campaign.findUnique({ where: { id } });
    const now = new Date();
    if (!c || c.status !== "SCHEDULED" || c.startAt > now || c.endAt <= now || !c.teamAId || !c.teamBId) return false;
    const other = await tx.campaign.count({ where: { status: { in: [...ACTIVE] }, id: { not: id } } });
    if (other > 0) return false;
    await tx.campaign.update({ where: { id }, data: { status: "LIVE" } });
    await tx.activityEvent.create({ data: { campaignId: id, type: "CAMPAIGN_START", message: "The battle is open." } });
    return true;
  });
}
