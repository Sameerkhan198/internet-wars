"use client";

import type { ReactNode } from "react";
import AnimatedNumber from "./AnimatedNumber";
import Mascot from "./Mascot";
import { formatINR, formatINRCompact } from "@/lib/money";
import type { CampaignScoreDTO, TeamDTO, TeamScoreDTO } from "@/lib/types";

/**
 * The arena: BULL side (team A) vs BEAR side (team B), with the countdown in
 * the middle and a dominance bar underneath.
 */
export default function Scoreboard({
  teamA,
  teamB,
  score,
  center,
  onBack,
  canBack,
}: {
  teamA: TeamDTO;
  teamB: TeamDTO;
  score: CampaignScoreDTO;
  center?: ReactNode;
  onBack?: (team: TeamDTO) => void;
  canBack?: boolean;
}) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-0 items-stretch">
        <SidePanel
          side="bull"
          team={teamA}
          score={score.teamA}
          leading={score.leaderTeamId === teamA.id}
          onBack={onBack}
          canBack={canBack}
        />
        <div className="flex md:flex-col items-center justify-center gap-4 px-2 md:px-6 py-2">
          <span className="font-mono text-xs font-bold tracking-[0.3em] text-muted md:mb-2">VS</span>
          {center}
        </div>
        <SidePanel
          side="bear"
          team={teamB}
          score={score.teamB}
          leading={score.leaderTeamId === teamB.id}
          onBack={onBack}
          canBack={canBack}
        />
      </div>

      <DominanceBar teamA={teamA} teamB={teamB} score={score} />
    </div>
  );
}

function SidePanel({
  side,
  team,
  score,
  leading,
  onBack,
  canBack,
}: {
  side: "bull" | "bear";
  team: TeamDTO;
  score: TeamScoreDTO;
  leading: boolean;
  onBack?: (team: TeamDTO) => void;
  canBack?: boolean;
}) {
  const isBull = side === "bull";
  const color = isBull ? "var(--bull)" : "var(--bear)";
  const glow = isBull ? "var(--bull-glow)" : "var(--bear-glow)";
  const dim = isBull ? "var(--bull-dim)" : "var(--bear-dim)";

  return (
    <div
      className="panel relative isolate flex flex-col transition-shadow duration-500"
      style={{
        borderColor: leading ? color : undefined,
        boxShadow: leading ? `0 0 0 1px ${color}, 0 0 48px -8px ${glow}` : undefined,
      }}
    >
      {/* side glow */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(90% 70% at ${isBull ? "0% 0%" : "100% 0%"}, ${dim}, transparent 70%)`,
        }}
      />

      <div className="panel-header" style={{ background: "transparent" }}>
        <span className="flex items-center gap-2" style={{ color }}>
          <span aria-hidden="true">{isBull ? "▲" : "▼"}</span>
          {isBull ? "Bull side" : "Bear side"}
        </span>
        {leading ? (
          <span className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold text-black" style={{ background: color }}>
            LEADING
          </span>
        ) : (
          <span>Trailing</span>
        )}
      </div>

      <div className={`relative flex items-center gap-4 p-4 sm:p-6 ${isBull ? "" : "flex-row-reverse text-right"}`}>
        <Mascot side={side} className="breathe h-20 w-20 sm:h-28 sm:w-28 md:h-20 md:w-20 xl:h-32 xl:w-32 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="text-sm sm:text-base font-semibold text-foreground truncate">{team.name}</div>
          <div className="font-mono text-[11px] text-muted mb-2">{team.shortName}</div>

          <div className="relative inline-block">
            {/* tick flash — remounts on every change of the total */}
            <span key={score.total} className={`absolute -inset-x-1.5 -inset-y-0.5 rounded ${isBull ? "flash-bull" : "flash-bear"}`} />
            <AnimatedNumber
              value={score.total}
              format={(n) => formatINR(n)}
              className="relative block text-3xl sm:text-4xl md:text-3xl lg:text-4xl xl:text-5xl font-bold leading-none whitespace-nowrap"
            />
          </div>

          <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs ${isBull ? "" : "justify-end"}`}>
            <span style={{ color }} className="font-semibold tabular-nums">
              {score.percentage.toFixed(1)}% share
            </span>
            <span className="text-muted tabular-nums">
              {score.supporterCount.toLocaleString("en-IN")} supporters
            </span>
          </div>
        </div>
      </div>

      {canBack && onBack && (
        <div className="hidden md:block mt-auto p-6 pt-0">
          <button
            onClick={() => onBack(team)}
            className="group w-full min-h-11 rounded font-mono text-sm font-bold uppercase tracking-wider text-black transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] cursor-pointer"
            style={{ background: color, boxShadow: `0 0 24px -6px ${glow}` }}
          >
            {isBull ? "▲" : "▼"} Back {team.shortName}
          </button>
        </div>
      )}
    </div>
  );
}

function DominanceBar({ teamA, teamB, score }: { teamA: TeamDTO; teamB: TeamDTO; score: CampaignScoreDTO }) {
  const empty = score.combinedTotal === 0;
  const aPct = empty ? 50 : score.teamA.percentage;
  const aLeading = score.leaderTeamId === teamA.id;

  return (
    <div className="panel mt-3">
      <div className="panel-header">
        <span className="text-foreground">Dominance</span>
        <span className="normal-case tracking-normal font-mono text-[11px]">
          {score.differenceAmount === 0 ? (
            <span className="text-muted">Dead even — every rupee counts</span>
          ) : (
            <>
              <span style={{ color: aLeading ? "var(--bull)" : "var(--bear)" }} className="font-semibold">
                {aLeading ? teamA.shortName : teamB.shortName}
              </span>
              <span className="text-muted"> leads by </span>
              <span className="text-foreground tabular-nums">{formatINRCompact(score.differenceAmount)}</span>
            </>
          )}
        </span>
      </div>
      <div className="px-4 py-3">
        <div className="flex justify-between font-mono text-xs mb-1.5 tabular-nums">
          <span className="text-bull font-semibold">▲ {teamA.shortName} {empty ? "—" : `${score.teamA.percentage.toFixed(1)}%`}</span>
          <span className="text-bear font-semibold">{empty ? "—" : `${score.teamB.percentage.toFixed(1)}%`} {teamB.shortName} ▼</span>
        </div>
        <div
          className="sweep relative h-3 rounded-sm overflow-hidden bg-white/5"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={aPct}
          aria-label={`${teamA.shortName} share of total support`}
        >
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
            style={{ width: `${aPct}%`, background: "linear-gradient(90deg, rgba(22,199,132,0.55), var(--bull))" }}
          />
          <div
            className="absolute inset-y-0 right-0 transition-[width] duration-700 ease-out"
            style={{ width: `${100 - aPct}%`, background: "linear-gradient(270deg, rgba(246,70,93,0.55), var(--bear))" }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground transition-[left] duration-700 ease-out"
            style={{ left: `calc(${aPct}% - 1px)` }}
          />
          {/* 50% reference */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-black/60" />
        </div>
      </div>
    </div>
  );
}
