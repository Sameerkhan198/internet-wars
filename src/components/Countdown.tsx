"use client";

import { useEffect, useState } from "react";

type Remaining = { days: number; hours: number; minutes: number; seconds: number; ended: boolean };

function getRemaining(endAt: string): Remaining {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, ended: false };
}

export default function Countdown({ endAt, status }: { endAt: string; status: string }) {
  // Server and client compute Date.now() at slightly different instants, so
  // the ticking values must never be part of the first render — otherwise
  // hydration mismatches. Render null (a stable placeholder) until mounted,
  // then start ticking from the client's own clock.
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    // Reading the clock is an external-system sync, not derived state — see
    // the identical rationale in profile/page.tsx's localStorage read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(getRemaining(endAt));
    const id = setInterval(() => setRemaining(getRemaining(endAt)), 1000);
    return () => clearInterval(id);
  }, [endAt]);

  if (status === "ENDED" || remaining?.ended) {
    return <Status label="Battle ended" color="var(--bear)" />;
  }

  if (status === "PAUSED") {
    return <Status label="Paused" color="var(--signal)" />;
  }

  const unit = (value: number | undefined, label: string) => (
    <div className="flex flex-col items-center w-10 sm:w-11">
      <div className="numeric text-xl sm:text-2xl font-semibold tabular-nums">
        {value === undefined ? "--" : String(value).padStart(2, "0")}
      </div>
      <div className="label !text-[9px] mt-0.5">{label}</div>
    </div>
  );

  return (
    <div className="text-center rounded border border-border bg-panel px-3 py-2">
      <div className="label mb-1.5">Closes in</div>
      <div className="flex items-start justify-center">
        {unit(remaining?.days, "D")}
        <span className="numeric text-lg text-muted">:</span>
        {unit(remaining?.hours, "H")}
        <span className="numeric text-lg text-muted">:</span>
        {unit(remaining?.minutes, "M")}
        <span className="numeric text-lg text-muted">:</span>
        {unit(remaining?.seconds, "S")}
      </div>
    </div>
  );
}

function Status({ label, color }: { label: string; color: string }) {
  return (
    <div className="text-center rounded border border-border bg-panel px-4 py-2">
      <div className="label mb-1">Status</div>
      <div className="font-mono text-sm font-bold uppercase tracking-wider" style={{ color }}>
        {label}
      </div>
    </div>
  );
}
