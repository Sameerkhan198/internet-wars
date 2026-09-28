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
      <div className="label mb-1">This browser</div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Your support</h1>
      <p className="text-sm text-muted mb-8">
        This browser&apos;s contribution history. Create an account in a future update to sync this across
        devices.
      </p>

      {!loaded && (
        <p className="font-mono text-xs text-muted py-8 text-center" role="status">
          Loading this browser&apos;s history…
        </p>
      )}

      {loaded && (
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="panel p-4">
            <div className="label mb-1">Total Supported</div>
            <div className="numeric text-2xl font-semibold">{formatINR(total)}</div>
          </div>
          <div className="panel p-4">
            <div className="label mb-1">Battles Participated</div>
            <div className="numeric text-2xl font-semibold">{battles}</div>
          </div>
        </div>
      )}

      <h2 className="label mb-3">Contribution history</h2>
      {loaded && contributions.length === 0 && (
        <p className="panel text-sm text-muted py-8 text-center">
          No contributions yet from this browser.
        </p>
      )}
      <ul className="space-y-2">
        {contributions.map((c) => (
          <li
            key={c.contributionId}
            className="panel flex items-center justify-between px-4 py-3 text-sm"
          >
            <div>
              <div className="font-semibold">{c.teamName}</div>
              <div className="font-mono text-xs text-muted">{new Date(c.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })} IST</div>
            </div>
            <div className="numeric font-bold">{formatINR(c.amountRupees * 100)}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
