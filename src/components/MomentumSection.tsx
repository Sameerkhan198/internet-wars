"use client";

import { formatINRCompact } from "@/lib/money";
import type { TeamDTO } from "@/lib/types";

export default function MomentumSection({
  teamA,
  teamB,
  momentum,
}: {
  teamA: TeamDTO;
  teamB: TeamDTO;
  momentum: { teamA10m: number; teamB10m: number };
}) {
  const leader =
    momentum.teamA10m === momentum.teamB10m
      ? null
      : momentum.teamA10m > momentum.teamB10m
        ? teamA
        : teamB;

  return (
    <section className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-red-500" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Live Momentum</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        <MomentumCard
          label={teamA.shortName}
          amount={momentum.teamA10m}
          accentVar="--team-a"
          highlighted={leader?.id === teamA.id}
        />
        <MomentumCard
          label={teamB.shortName}
          amount={momentum.teamB10m}
          accentVar="--team-b"
          highlighted={leader?.id === teamB.id}
        />
      </div>
      {leader && (momentum.teamA10m > 0 || momentum.teamB10m > 0) && (
        <p className="text-center text-sm mt-4 font-semibold">
          🔥 <span style={{ color: `var(${leader.id === teamA.id ? "--team-a" : "--team-b"})` }}>{leader.shortName}</span>{" "}
          <span className="text-muted font-normal">is gaining momentum</span>
        </p>
      )}
    </section>
  );
}

function MomentumCard({
  label,
  amount,
  accentVar,
  highlighted,
}: {
  label: string;
  amount: number;
  accentVar: string;
  highlighted: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4 transition-colors duration-500"
      style={{
        borderColor: highlighted ? `var(${accentVar})` : "var(--border)",
        background: "var(--background-elevated)",
      }}
    >
      <div className="text-xs uppercase tracking-wider text-muted mb-1">{label} · last 10 min</div>
      <div className="numeric text-xl sm:text-2xl font-black">
        +{formatINRCompact(amount)}
      </div>
    </div>
  );
}
