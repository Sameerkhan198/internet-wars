"use client";

import AnimatedNumber from "./AnimatedNumber";
import { formatINR, formatINRCompact } from "@/lib/money";
import type { CampaignScoreDTO, TeamDTO } from "@/lib/types";

export default function Scoreboard({
  teamA,
  teamB,
  score,
}: {
  teamA: TeamDTO;
  teamB: TeamDTO;
  score: CampaignScoreDTO;
}) {
  const aLeading = score.leaderTeamId === teamA.id;
  const bLeading = score.leaderTeamId === teamB.id;
  const aPct = score.teamA.percentage;

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3 sm:gap-8">
        <TeamPanel
          team={teamA}
          score={score.teamA}
          leading={aLeading}
          accentVar="--team-a"
          glowVar="--team-a-glow"
          align="left"
        />
        <TeamPanel
          team={teamB}
          score={score.teamB}
          leading={bLeading}
          accentVar="--team-b"
          glowVar="--team-b-glow"
          align="right"
        />
      </div>

      <div className="relative mt-6 h-3 sm:h-4 rounded-full overflow-hidden bg-white/5 border border-border">
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
          style={{ width: `${aPct}%`, background: "var(--team-a)" }}
        />
        <div
          className="absolute inset-y-0 right-0 transition-[width] duration-700 ease-out"
          style={{ width: `${100 - aPct}%`, background: "var(--team-b)" }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-background transition-[left] duration-700 ease-out"
          style={{ left: `${aPct}%` }}
        />
      </div>

      <div className="mt-4 text-center">
        {score.differenceAmount === 0 ? (
          <span className="text-sm text-muted font-medium">DEAD EVEN — every rupee matters</span>
        ) : (
          <span className="text-sm font-bold">
            <span style={{ color: `var(${aLeading ? "--team-a" : "--team-b"})` }}>
              {aLeading ? teamA.shortName : teamB.shortName}
            </span>
            <span className="text-muted font-medium"> LEADING BY </span>
            <span className="numeric">{formatINRCompact(score.differenceAmount)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function TeamPanel({
  team,
  score,
  leading,
  accentVar,
  glowVar,
  align,
}: {
  team: TeamDTO;
  score: { total: number; supporterCount: number; percentage: number };
  leading: boolean;
  accentVar: string;
  glowVar: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-6 transition-shadow duration-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={{
        borderColor: leading ? `var(${accentVar})` : "var(--border)",
        boxShadow: leading ? `0 0 40px ${`var(${glowVar})`}` : "none",
        background: "var(--background-elevated)",
      }}
    >
      <div
        className="text-xs sm:text-sm font-bold tracking-widest uppercase mb-2"
        style={{ color: `var(${accentVar})` }}
      >
        {team.shortName}
      </div>
      <AnimatedNumber
        value={score.total}
        format={(n) => formatINR(n)}
        className="block text-2xl sm:text-4xl md:text-5xl font-black leading-none"
      />
      <div className="mt-2 flex items-baseline gap-2 justify-start sm:gap-3" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        <span className="numeric text-lg sm:text-xl font-bold text-muted">{score.percentage.toFixed(1)}%</span>
        {leading && (
          <span
            className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: `var(${accentVar})`, color: "#08090c" }}
          >
            LEADING
          </span>
        )}
      </div>
      <div className="text-xs sm:text-sm text-muted mt-1">
        {score.supporterCount.toLocaleString("en-IN")} supporters
      </div>
    </div>
  );
}
