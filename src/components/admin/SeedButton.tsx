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

export default function SeedButton({ allowed, reason, phrase }: { allowed: boolean; reason?: string; phrase: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "idle" });
  const [typed, setTyped] = useState("");

  async function runSeed() {
    setState({ step: "running" });
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: typed }),
      });
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
        <div className="font-bold text-amber-400 mb-1">Destructive: this deletes all campaign data</div>
        <div className="text-muted mb-3">
          Every existing campaign, contribution and activity event will be deleted and replaced with a fresh
          demo battle. There is no undo.
        </div>
        <label htmlFor="seed-confirm" className="block text-xs text-muted mb-1">
          Type <span className="font-mono text-foreground">{phrase}</span> to confirm
        </label>
        <input
          id="seed-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="mb-3 w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
        />
        <div className="flex gap-2">
          <button
            onClick={runSeed}
            disabled={typed !== phrase}
            className="rounded-lg px-3 py-1.5 font-bold uppercase tracking-wide text-xs bg-danger text-black disabled:opacity-30"
          >
            Delete and reload demo data
          </button>
          <button
            onClick={() => {
              setTyped("");
              setState({ step: "idle" });
            }}
            className="rounded-lg px-3 py-1.5 text-xs border border-border hover:border-foreground/40"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <span className="text-xs text-muted border border-border rounded-lg px-3 py-1.5" title={reason}>
        Demo reset disabled — {reason}
      </span>
    );
  }

  return (
    <button
      disabled={state.step === "running"}
      onClick={() => setState({ step: "confirming" })}
      className="text-sm border border-border rounded-lg px-3 py-1.5 hover:border-foreground/40 disabled:opacity-40"
    >
      {state.step === "running" ? "Resetting demo data..." : "Reset demo data…"}
    </button>
  );
}
