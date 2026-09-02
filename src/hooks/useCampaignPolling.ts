"use client";

import { useEffect, useRef } from "react";
import type { CampaignScoreDTO, ActivityEventDTO } from "@/lib/types";

type CampaignApiResponse = {
  score: CampaignScoreDTO;
  momentum: { teamA10m: number; teamB10m: number };
};

/**
 * Polls for score/momentum + new activity events instead of pushing over SSE.
 * A single long-lived in-memory pub/sub (the previous approach) only works
 * within one persistent server process — it silently breaks on serverless
 * platforms like Vercel, where each request can land on a different function
 * instance. Polling works identically everywhere, at the cost of a few
 * seconds of latency instead of instant push.
 */
export function useCampaignPolling(
  slug: string,
  intervalMs: number,
  onUpdate: (data: CampaignApiResponse) => void,
  onActivity: (events: ActivityEventDTO[]) => void
) {
  const onUpdateRef = useRef(onUpdate);
  const onActivityRef = useRef(onActivity);
  const lastSeenIdRef = useRef<string | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onActivityRef.current = onActivity;
  }, [onUpdate, onActivity]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [campaignRes, activityRes] = await Promise.all([
          fetch(`/api/campaigns/${slug}`),
          fetch(`/api/activity/${slug}?limit=10`),
        ]);
        if (cancelled) return;

        if (campaignRes.ok) {
          const data = (await campaignRes.json()) as CampaignApiResponse;
          onUpdateRef.current(data);
        }

        if (activityRes.ok) {
          const { events } = (await activityRes.json()) as { events: ActivityEventDTO[] };
          // events arrive newest-first; only surface ones we haven't shown yet.
          const lastSeenId = lastSeenIdRef.current;
          const freshEvents = lastSeenId
            ? events.slice(0, events.findIndex((e) => e.id === lastSeenId)).reverse()
            : events.slice(0, 1).reverse(); // first poll: seed with just the latest, don't dump history
          if (events.length > 0) lastSeenIdRef.current = events[0].id;
          if (freshEvents.length > 0) onActivityRef.current(freshEvents);
        }
      } catch {
        // A missed poll just means the next one (a few seconds later) catches up.
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug, intervalMs]);
}
