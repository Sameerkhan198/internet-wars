"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/money";

type State =
  | { step: "idle" }
  | { step: "confirming" }
  | { step: "running" }
  | { step: "done"; teams: { shortName: string; total: number; supporters: number }[] }
  | { step: "error"; message: string };

export default function SeedButton() {
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "idle" });

  async function runSeed() {
    setState({ step: "running" });
    try {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState({ step: "error", message: data.error ?? "Seeding failed." });
        return;
      }
      setState({ step: "done", teams: data.teams ?? [] });
      router.refresh();
    } catch {
      setState({ step: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  }

  if (state.step === "done") {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <div className="font-bold text-emerald-400 mb-1">Demo data loaded</div>
        <div className="text-muted">
          {state.teams.map((t) => `${t.shortName}: ${formatINR(t.total)} from ${t.supporters} supporters`).join(" · ")}
        </div>
        <Link href="/" className="inline-block mt-2 underline underline-offset-2 hover:text-foreground">
          View the battle page →
        </Link>
      </div>
    );
  }

  if (state.step === "error") {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm">
        <div className="font-bold text-danger mb-1">Seeding failed</div>
        <div className="text-muted">{state.message}</div>
        <button
          onClick={() => setState({ step: "idle" })}
          className="mt-2 underline underline-offset-2 hover:text-foreground"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.step === "confirming") {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <div className="font-bold text-amber-400 mb-1">This replaces all campaign data</div>
        <div className="text-muted mb-3">
          Every existing campaign, contribution and activity event will be deleted and replaced with a fresh
          demo battle. There is no undo.
        </div>
        <div className="flex gap-2">
          <button
            onClick={runSeed}
            className="rounded-lg px-3 py-1.5 font-bold uppercase tracking-wide text-xs bg-foreground text-background"
          >
            Yes, replace it
          </button>
          <button
            onClick={() => setState({ step: "idle" })}
            className="rounded-lg px-3 py-1.5 text-xs border border-border hover:border-foreground/40"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      disabled={state.step === "running"}
      onClick={() => setState({ step: "confirming" })}
      className="text-sm border border-border rounded-lg px-3 py-1.5 hover:border-foreground/40 disabled:opacity-40"
    >
      {state.step === "running" ? "Loading demo data..." : "Load demo data"}
    </button>
  );
}
