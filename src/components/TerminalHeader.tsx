"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Battle" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/history", label: "History" },
  { href: "/legal/rules", label: "Rules" },
];

export default function TerminalHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-12 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Internet Wars home">
          <LogoMark />
          <span className="font-mono text-sm font-bold tracking-tight">
            INTERNET<span className="text-muted">/</span>WARS
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1 ml-4" aria-label="Main">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded transition-colors ${
                  active ? "bg-white/[0.06] text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Clock />
        </div>
      </div>

      {/* Mobile nav */}
      <nav
        className="sm:hidden flex items-center gap-1 px-2 pb-2 overflow-x-auto"
        aria-label="Main mobile"
      >
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded whitespace-nowrap ${
                active ? "bg-white/[0.06] text-foreground" : "text-muted"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <rect x="0.5" y="0.5" width="23" height="23" rx="4" fill="#0b0f14" stroke="var(--border-strong)" />
      <path d="M5 15 L9 8 L13 15 Z" fill="var(--bull)" />
      <path d="M11 9 L19 9 L15 16 Z" fill="var(--bear)" />
    </svg>
  );
}

function Clock() {
  // Clock differs between server render and hydration, so it only appears
  // after mount (same pattern as Countdown).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const text = now
    ? now.toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" })
    : "--:--:--";
  return (
    <span className="font-mono text-xs tabular-nums text-muted" aria-label="Current time, India">
      {text} <span className="text-[10px]">IST</span>
    </span>
  );
}
