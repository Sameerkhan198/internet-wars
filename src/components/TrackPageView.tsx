"use client";

import { useEffect, useRef } from "react";
import { isReturningVisitor, track } from "@/lib/analytics";

/** Fires one page_view (plus leaderboard_viewed on that page) per mount. */
export default function TrackPageView({ page, campaignSlug }: { page: "battle" | "leaderboard" | "history"; campaignSlug?: string }) {
  // Guard: React dev StrictMode runs effects twice; count each view once.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("page_view", { page, returning: isReturningVisitor() }, campaignSlug);
    if (page === "leaderboard") track("leaderboard_viewed", {}, campaignSlug);
  }, [page, campaignSlug]);
  return null;
}
