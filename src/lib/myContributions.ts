"use client";

// Guest identity for the MVP: since full account auth is out of scope, we
// remember a browser's own successful contributions locally so /profile can
// show something meaningful. This is convenience only — it is never used as
// a source of truth for scores (the server ledger is), and holds no
// sensitive data (no payment details, no PII beyond a chosen display name).
import type { TeamDTO } from "./types";

export type MyContribution = {
  contributionId: string;
  campaignSlug: string;
  teamName: string;
  teamSlug: string;
  amountRupees: number;
  createdAt: string;
};

const KEY = "iw_my_contributions";

export function rememberContribution(
  contributionId: string,
  team: TeamDTO,
  amountRupees: number,
  campaignSlug: string
) {
  if (typeof window === "undefined") return;
  const existing = getMyContributions();
  if (existing.some((c) => c.contributionId === contributionId)) return;
  existing.unshift({
    contributionId,
    campaignSlug,
    teamName: team.name,
    teamSlug: team.slug,
    amountRupees,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(KEY, JSON.stringify(existing.slice(0, 100)));
}

export function getMyContributions(): MyContribution[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
