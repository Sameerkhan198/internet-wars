"use client";

import type { ActivityEventDTO } from "@/lib/types";

/** Short type codes instead of emoji — reads like a terminal event log. */
const TAG: Record<string, { code: string; color: string }> = {
  CONTRIBUTION: { code: "BACK", color: "var(--foreground)" },
  LEAD_CHANGE: { code: "LEAD", color: "var(--signal)" },
  MILESTONE: { code: "MILE", color: "var(--signal)" },
  LARGE_SUPPORT: { code: "BIG", color: "var(--signal)" },
  MOMENTUM_CHANGE: { code: "MOVE", color: "var(--muted)" },
  CAMPAIGN_START: { code: "OPEN", color: "var(--bull)" },
  CAMPAIGN_END: { code: "CLOSE", color: "var(--bear)" },
};

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" });
}

export default function ActivityFeed({ events }: { events: ActivityEventDTO[] }) {
  return (
    <section className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="flex items-center gap-2 text-foreground">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-bear" />
          Live activity
        </span>
        <span>Live</span>
      </div>
      {events.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center font-mono text-xs text-muted">
          No activity yet. Be the first person to back a side.
        </div>
      ) : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-border/60" aria-live="polite">
          {events.map((e) => {
            const tag = TAG[e.type] ?? { code: "EVT", color: "var(--muted)" };
            return (
              <li key={e.id} className="slide-in flex items-start gap-3 px-3 py-2 font-mono text-xs">
                <span className="text-muted tabular-nums shrink-0">{time(e.createdAt)}</span>
                <span className="shrink-0 w-11 font-semibold" style={{ color: tag.color }}>
                  {tag.code}
                </span>
                <span className="flex-1 text-foreground/90 font-sans text-[13px] leading-snug">{e.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
