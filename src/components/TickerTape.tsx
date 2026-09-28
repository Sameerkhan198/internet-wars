"use client";

import { formatINRCompact } from "@/lib/money";
import type { CampaignScoreDTO, TeamDTO } from "@/lib/types";

type Item = { label: string; value: string; tone?: "bull" | "bear" };

/** Scrolling tape of live battle stats. Every value is real server data. */
export default function TickerTape({
  teamA,
  teamB,
  score,
  momentum,
}: {
  teamA: TeamDTO;
  teamB: TeamDTO;
  score: CampaignScoreDTO;
  momentum: { teamA10m: number; teamB10m: number };
}) {
  const items: Item[] = [
    { label: `${teamA.shortName}`, value: `${formatINRCompact(score.teamA.total)} ▲ ${score.teamA.percentage.toFixed(1)}%`, tone: "bull" },
    { label: `${teamB.shortName}`, value: `${formatINRCompact(score.teamB.total)} ▼ ${score.teamB.percentage.toFixed(1)}%`, tone: "bear" },
    { label: "Lead", value: formatINRCompact(score.differenceAmount) },
    { label: "Total support", value: formatINRCompact(score.combinedTotal) },
    {
      label: "Supporters",
      value: (score.teamA.supporterCount + score.teamB.supporterCount).toLocaleString("en-IN"),
    },
    { label: `${teamA.shortName} 10m`, value: `+${formatINRCompact(momentum.teamA10m)}`, tone: "bull" },
    { label: `${teamB.shortName} 10m`, value: `+${formatINRCompact(momentum.teamB10m)}`, tone: "bear" },
  ];

  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2 px-5 font-mono text-xs whitespace-nowrap border-r border-border">
          <span className="text-muted uppercase tracking-wider">{it.label}</span>
          <span
            className="tabular-nums font-semibold"
            style={{ color: it.tone === "bull" ? "var(--team-a)" : it.tone === "bear" ? "var(--team-b)" : "var(--foreground)" }}
          >
            {it.value}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="ticker relative overflow-hidden border-b border-border bg-panel h-9 flex items-center" aria-label="Live battle stats">
      <div className="ticker-track flex">
        {row(false)}
        {row(true)}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
