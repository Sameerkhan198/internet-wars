const MAP: Record<string, { text: string; color: string }> = {
  DRAFT: { text: "Draft", color: "var(--muted)" },
  SCHEDULED: { text: "Scheduled", color: "var(--signal)" },
  LIVE: { text: "Live", color: "var(--bear)" },
  PAUSED: { text: "Paused", color: "var(--signal)" },
  ENDED: { text: "Closed", color: "var(--muted)" },
  CANCELLED: { text: "Cancelled", color: "var(--muted)" },
};

/** Campaign status as a bordered terminal tag. Text label, not colour alone. */
export default function StatusPill({ status }: { status: string }) {
  const s = MAP[status] ?? { text: status, color: "var(--muted)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
      style={{ color: s.color, borderColor: s.color }}
    >
      {status === "LIVE" && <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />}
      {s.text}
    </span>
  );
}
