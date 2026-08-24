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
    return (
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-muted mb-1">Battle Status</div>
        <div className="text-lg font-bold text-danger">BATTLE ENDED</div>
      </div>
    );
  }

  if (status === "PAUSED") {
    return (
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-muted mb-1">Battle Status</div>
        <div className="text-lg font-bold text-amber-400">TEMPORARILY PAUSED</div>
      </div>
    );
  }

  const unit = (value: number | undefined, label: string) => (
    <div className="flex flex-col items-center min-w-[56px] sm:min-w-[68px]">
      <div className="numeric text-2xl sm:text-4xl font-black tabular-nums">
        {value === undefined ? "--" : String(value).padStart(2, "0")}
      </div>
      <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted mt-1">{label}</div>
    </div>
  );

  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-widest text-muted mb-2">Time Remaining</div>
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        {unit(remaining?.days, "Days")}
        <span className="text-xl text-muted -mt-4">:</span>
        {unit(remaining?.hours, "Hrs")}
        <span className="text-xl text-muted -mt-4">:</span>
        {unit(remaining?.minutes, "Min")}
        <span className="text-xl text-muted -mt-4">:</span>
        {unit(remaining?.seconds, "Sec")}
      </div>
    </div>
  );
}
