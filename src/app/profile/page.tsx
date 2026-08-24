"use client";

import { useEffect, useState } from "react";
import { getMyContributions, type MyContribution } from "@/lib/myContributions";
import { formatINR } from "@/lib/money";

export default function ProfilePage() {
  const [contributions, setContributions] = useState<MyContribution[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage is a browser-only external store; reading it must happen
    // after mount (not during the initial useState call) so the server-
    // rendered [] markup matches the client's first render and hydration
    // doesn't mismatch. This is the documented "subscribe to an external
    // system" effect pattern, which the stricter set-state-in-effect lint
    // rule doesn't distinguish from a derived-state anti-pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContributions(getMyContributions());
    setLoaded(true);
  }, []);

  const total = contributions.reduce((sum, c) => sum + c.amountRupees * 100, 0);
  const battles = new Set(contributions.map((c) => c.campaignSlug)).size;

  return (
    <main className="flex-1 mx-auto max-w-2xl w-full px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-black tracking-tight mb-1">Your Profile</h1>
      <p className="text-sm text-muted mb-8">
        This browser&apos;s contribution history. Create an account in a future update to sync this across
        devices.
      </p>

      {loaded && (
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="rounded-xl border border-border p-4 bg-background-elevated/40">
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Total Supported</div>
            <div className="numeric text-2xl font-black">{formatINR(total)}</div>
          </div>
          <div className="rounded-xl border border-border p-4 bg-background-elevated/40">
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Battles Participated</div>
            <div className="numeric text-2xl font-black">{battles}</div>
          </div>
        </div>
      )}

      <h2 className="text-sm font-bold uppercase tracking-widest text-muted mb-3">Contribution History</h2>
      {loaded && contributions.length === 0 && (
        <p className="text-sm text-muted py-8 text-center border border-border rounded-xl">
          No contributions yet from this browser.
        </p>
      )}
      <ul className="space-y-2">
        {contributions.map((c) => (
          <li
            key={c.contributionId}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm bg-background-elevated/30"
          >
            <div>
              <div className="font-semibold">{c.teamName}</div>
              <div className="text-xs text-muted">{new Date(c.createdAt).toLocaleString("en-IN")}</div>
            </div>
            <div className="numeric font-bold">{formatINR(c.amountRupees * 100)}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
