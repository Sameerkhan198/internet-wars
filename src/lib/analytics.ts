"use client";

import type { EventName, EventProps } from "@/lib/analyticsEvents";

/**
 * Client-side event helper. Privacy model:
 *  - no cookies; a random session id lives in sessionStorage (this tab only);
 *  - "returning" is a single boolean flag in localStorage, no identifier;
 *  - honours Do Not Track and Global Privacy Control (sends nothing);
 *  - fire-and-forget via sendBeacon, so it never blocks or breaks the UI.
 */
function optedOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("iw_sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("iw_sid", id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

/** True if this browser has visited before (and marks it as seen). */
export function isReturningVisitor(): boolean {
  try {
    const seen = localStorage.getItem("iw_seen") === "1";
    if (!seen) localStorage.setItem("iw_seen", "1");
    return seen;
  } catch {
    return false;
  }
}

export function track<N extends EventName>(name: N, props: EventProps<N>, campaignSlug?: string) {
  if (optedOut()) return;
  try {
    const body = JSON.stringify({ name, props, campaignSlug, sessionId: sessionId() });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/events", blob)) {
      void fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics must never affect the product.
  }
}
