"use client";

import { useMemo, useRef, useState } from "react";
import { formatINR, formatINRCompact } from "@/lib/money";
import type { ScorePointDTO, TeamDTO } from "@/lib/types";

const W = 1000;
const H = 300;

/** IST, fixed — identical on server and client, so no hydration mismatch. */
function fmtTime(iso: string, withDate: boolean) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    ...(withDate ? { day: "2-digit", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Cumulative verified support per side over the battle, drawn like a price
 * chart. Every point comes from the server ledger (computeScoreSeries) plus
 * the live polled total — nothing here is simulated.
 */
export default function BattleChart({
  series,
  teamA,
  teamB,
}: {
  series: ScorePointDTO[];
  teamA: TeamDTO;
  teamB: TeamDTO;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const { max, pathA, pathB, areaA, areaB, ticks } = useMemo(() => {
    const top = Math.max(1, ...series.map((p) => Math.max(p.a, p.b)));
    const max = niceCeil(top * 1.1);
    const x = (i: number) => (series.length <= 1 ? W : (i / (series.length - 1)) * W);
    const y = (v: number) => H - (v / max) * H;
    const line = (key: "a" | "b") =>
      series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    const pathA = line("a");
    const pathB = line("b");
    return {
      max,
      pathA,
      pathB,
      areaA: `${pathA} L${W},${H} L0,${H} Z`,
      areaB: `${pathB} L${W},${H} L0,${H} Z`,
      ticks: [0.25, 0.5, 0.75, 1].map((f) => max * f),
    };
  }, [series]);

  const last = series[series.length - 1];
  const active = hover !== null ? series[hover] : last;
  const tagTops = last ? spreadTags(last.a, last.b, max) : { a: 0, b: 0 };

  function onMove(e: React.PointerEvent) {
    const box = boxRef.current;
    if (!box || series.length < 2) return;
    const r = box.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(f * (series.length - 1)));
  }

  const hoverX = hover !== null && series.length > 1 ? (hover / (series.length - 1)) * 100 : null;
  const xLabels = series.length > 1 ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (series.length - 1))) : [];

  return (
    <div className="panel">
      <div className="panel-header flex-wrap">
        <span className="flex items-center gap-2">
          <span className="text-foreground">Battle chart</span>
          <span className="hidden sm:inline">· cumulative verified support</span>
        </span>
        <span className="flex items-center gap-3 normal-case tracking-normal">
          <Legend color="var(--team-a)" label={teamA.shortName} value={active ? formatINRCompact(active.a) : "—"} />
          <Legend color="var(--team-b)" label={teamB.shortName} value={active ? formatINRCompact(active.b) : "—"} />
        </span>
      </div>

      <div className="relative pr-14 sm:pr-16 pl-2 pt-4 pb-7">
        <div
          ref={boxRef}
          className="relative h-56 sm:h-72 touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Chart of cumulative support. ${teamA.shortName} ${last ? formatINR(last.a) : ""}, ${teamB.shortName} ${last ? formatINR(last.b) : ""}.`}
        >
          {/* horizontal grid + right-side price axis */}
          {ticks.map((v) => (
            <div key={v} className="absolute inset-x-0 border-t border-dashed border-white/[0.06]" style={{ top: `${100 - (v / max) * 100}%` }}>
              <span className="absolute -right-14 sm:-right-16 -translate-y-1/2 font-mono text-[10px] text-muted">
                {formatINRCompact(v)}
              </span>
            </div>
          ))}

          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="area-bull" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--team-a)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--team-a)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="area-bear" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--team-b)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--team-b)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={areaB} fill="url(#area-bear)" />
            <path d={areaA} fill="url(#area-bull)" />
            <path d={pathB} fill="none" stroke="var(--team-b)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <path d={pathA} fill="none" stroke="var(--team-a)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>

          {/* last-value price tags on the axis */}
          {last && (
            <>
              <PriceTag value={last.a} top={tagTops.a} color="var(--team-a)" />
              <PriceTag value={last.b} top={tagTops.b} color="var(--team-b)" />
            </>
          )}

          {/* crosshair */}
          {hoverX !== null && active && (
            <>
              <div className="absolute inset-y-0 w-px bg-white/25 pointer-events-none" style={{ left: `${hoverX}%` }} />
              <div
                className="absolute -bottom-6 -translate-x-1/2 rounded bg-border-strong px-1.5 py-0.5 font-mono text-[10px] text-foreground whitespace-nowrap pointer-events-none"
                style={{ left: `${Math.min(92, Math.max(8, hoverX))}%` }}
              >
                {fmtTime(active.t, true)}
              </div>
            </>
          )}

          {/* time axis */}
          {hoverX === null &&
            xLabels.map((i, n) => (
              <span
                key={n}
                className={`absolute -bottom-6 font-mono text-[10px] text-muted whitespace-nowrap ${
                  n === 0 || n === xLabels.length - 1 ? "" : "hidden sm:inline"
                }`}
                style={{
                  left: `${(i / (series.length - 1)) * 100}%`,
                  transform: n === 0 ? "none" : n === xLabels.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                {fmtTime(series[i].t, true)}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px]">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      <span className="text-muted">{label}</span>
      <span className="text-foreground tabular-nums">{value}</span>
    </span>
  );
}

/** Axis tag positions (% from top), pushed apart so close totals don't overlap. */
function spreadTags(a: number, b: number, max: number, gap = 8) {
  let ta = 100 - (a / max) * 100;
  let tb = 100 - (b / max) * 100;
  const d = Math.abs(ta - tb);
  if (d < gap) {
    const push = (gap - d) / 2;
    if (ta <= tb) {
      ta -= push;
      tb += push;
    } else {
      ta += push;
      tb -= push;
    }
  }
  return { a: ta, b: tb };
}

function PriceTag({ value, top, color }: { value: number; top: number; color: string }) {
  return (
    <span
      className="absolute -right-14 sm:-right-16 -translate-y-1/2 rounded-sm px-1 py-px font-mono text-[10px] font-semibold text-black"
      style={{ top: `${top}%`, background: color }}
    >
      {formatINRCompact(value)}
    </span>
  );
}

/** Round up to a 1/2/5 × 10^n step so axis labels are clean. */
function niceCeil(n: number) {
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  for (const m of [1, 2, 5, 10]) if (m * p >= n) return m * p;
  return 10 * p;
}
