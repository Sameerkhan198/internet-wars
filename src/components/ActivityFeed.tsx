"use client";

import type { ActivityEventDTO } from "@/lib/types";

const EMOJI: Record<string, string> = {
  CONTRIBUTION: "⚡",
  LEAD_CHANGE: "🚨",
  MILESTONE: "🎉",
  LARGE_SUPPORT: "🔥",
  MOMENTUM_CHANGE: "📈",
  CAMPAIGN_START: "🏁",
  CAMPAIGN_END: "🏆",
};

export default function ActivityFeed({ events }: { events: ActivityEventDTO[] }) {
  return (
    <section className="w-full">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Live Activity</h2>
      {events.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-muted text-sm">
          No activity yet. Be the first person to back a side.
        </div>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {events.map((e) => (
            <li
              key={e.id}
              className="slide-in flex items-start gap-2 text-sm rounded-lg border border-border bg-background-elevated/60 px-3 py-2"
            >
              <span>{EMOJI[e.type] ?? "•"}</span>
              <span className="flex-1">{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
