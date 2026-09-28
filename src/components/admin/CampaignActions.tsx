"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LABELS: Record<string, { label: string; confirm?: string; danger?: boolean }> = {
  schedule: { label: "Schedule", confirm: "Publish this battle as scheduled? It opens automatically at its start time." },
  unschedule: { label: "Back to draft" },
  start: { label: "Start now", confirm: "Open this battle to supporters right now?" },
  pause: { label: "Pause", confirm: "Pause contributions? The scoreboard stays visible." },
  resume: { label: "Resume" },
  close: { label: "Close battle", confirm: "Close this battle now? The result is final and it becomes part of history.", danger: true },
  cancel: { label: "Cancel battle", confirm: "Cancel this scheduled battle? It won't open.", danger: true },
};

export default function CampaignActions({ campaignId, actions }: { campaignId: string; actions: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function run(action: string) {
    const meta = LABELS[action];
    if (meta?.confirm && !window.confirm(meta.confirm)) return;
    setBusy(action);
    setError("");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Couldn't change the status.");
      else router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (actions.length === 0) {
    return <p className="text-xs text-muted">No actions — this battle is closed and part of the public record.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => run(a)}
            disabled={busy !== null}
            className={`min-h-10 px-4 rounded font-mono text-xs font-bold uppercase tracking-wider border disabled:opacity-40 ${
              LABELS[a]?.danger ? "border-danger text-danger hover:bg-danger/10" : "border-border hover:border-foreground/40"
            }`}
          >
            {busy === a ? "Working…" : (LABELS[a]?.label ?? a)}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
