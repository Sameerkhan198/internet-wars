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
  onActivity: (events: ActivityEventDTO[]) => void,
  /** Called after every poll: true if the verified score loaded, false if not. */
  onFeedHealth?: (ok: boolean) => void
) {
  const onUpdateRef = useRef(onUpdate);
  const onActivityRef = useRef(onActivity);
  const onFeedHealthRef = useRef(onFeedHealth);
  const lastSeenIdRef = useRef<string | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onActivityRef.current = onActivity;
    onFeedHealthRef.current = onFeedHealth;
  }, [onUpdate, onActivity, onFeedHealth]);

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
          onFeedHealthRef.current?.(true);
        } else {
          onFeedHealthRef.current?.(false);
        }

        if (activityRes.ok) {
          const { events } = (await activityRes.json()) as { events: ActivityEventDTO[] };
          // Events arrive newest-first and are prepended newest-first, so the
          // feed keeps newest on top. Only surface ones we haven't shown yet;
          // if the last-seen event scrolled out of this page, show the page.
          const lastSeenId = lastSeenIdRef.current;
          const seenAt = lastSeenId ? events.findIndex((e) => e.id === lastSeenId) : -1;
          const freshEvents = !lastSeenId
            ? events.slice(0, 1) // first poll: seed with just the latest, don't dump history
            : seenAt === -1
              ? events
              : events.slice(0, seenAt);
          if (events.length > 0) lastSeenIdRef.current = events[0].id;
          if (freshEvents.length > 0) onActivityRef.current(freshEvents);
        }
      } catch {
        // A missed poll: the next one catches up; the page is told so it can
        // flag the shown figures as stale if this keeps happening.
        if (!cancelled) onFeedHealthRef.current?.(false);
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
