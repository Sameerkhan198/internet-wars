"use client";

import { formatINRCompact } from "@/lib/money";
import type { TeamDTO } from "@/lib/types";

/** Momentum: verified support in the last 10 minutes, per side. */
export default function MomentumSection({
  teamA,
  teamB,
  momentum,
}: {
  teamA: TeamDTO;
  teamB: TeamDTO;
  momentum: { teamA10m: number; teamB10m: number };
}) {
  const total = momentum.teamA10m + momentum.teamB10m;
  const aShare = total === 0 ? 50 : (momentum.teamA10m / total) * 100;
  const leader =
    momentum.teamA10m === momentum.teamB10m ? null : momentum.teamA10m > momentum.teamB10m ? teamA : teamB;

  return (
    <section className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="flex items-center gap-2 text-foreground">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-signal" />
          Momentum
        </span>
        <span>Last 10 min</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border">
        <FlowCell label={teamA.shortName} amount={momentum.teamA10m} side="bull" />
        <FlowCell label={teamB.shortName} amount={momentum.teamB10m} side="bear" />
      </div>

      <div className="px-4 pb-4 mt-auto">
        <div className="flex h-1.5 rounded-sm overflow-hidden bg-white/5">
          <div className="bg-team-a transition-[width] duration-700" style={{ width: total === 0 ? "0%" : `${aShare}%` }} />
          <div className="bg-team-b transition-[width] duration-700" style={{ width: total === 0 ? "0%" : `${100 - aShare}%` }} />
        </div>
        <p className="mt-3 font-mono text-xs text-muted">
          {total === 0 ? (
            "No verified support in the last 10 minutes."
          ) : leader ? (
            <>
              <span style={{ color: leader.id === teamA.id ? "var(--team-a)" : "var(--team-b)" }} className="font-semibold">
                {leader.shortName}
              </span>{" "}
              is gaining momentum
            </>
          ) : (
            "Momentum is balanced."
          )}
        </p>
      </div>
    </section>
  );
}

function FlowCell({ label, amount, side }: { label: string; amount: number; side: "bull" | "bear" }) {
  const color = side === "bull" ? "var(--team-a)" : "var(--team-b)";
  return (
    <div className="p-4">
      <div className="label mb-1">{label}</div>
      <div className="numeric text-2xl font-semibold" style={{ color: amount > 0 ? color : "var(--foreground)" }}>
        +{formatINRCompact(amount)}
      </div>
    </div>
  );
}
