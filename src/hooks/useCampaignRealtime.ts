"use client";

import { useEffect, useRef } from "react";
import type { ScoreUpdatePayload, ActivityEventDTO } from "@/lib/types";

export function useCampaignRealtime(
  slug: string,
  onScore: (payload: ScoreUpdatePayload) => void,
  onActivity: (payload: ActivityEventDTO & { message: string }) => void
) {
  const onScoreRef = useRef(onScore);
  const onActivityRef = useRef(onActivity);

  useEffect(() => {
    onScoreRef.current = onScore;
    onActivityRef.current = onActivity;
  }, [onScore, onActivity]);

  useEffect(() => {
    const source = new EventSource(`/api/activity/${slug}/stream`);

    source.addEventListener("score", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as ScoreUpdatePayload;
      onScoreRef.current(data);
    });

    source.addEventListener("activity", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        id: string;
        eventType: string;
        message: string;
        createdAt: string;
      };
      onActivityRef.current({ id: data.id, type: data.eventType, message: data.message, createdAt: data.createdAt });
    });

    return () => source.close();
  }, [slug]);
}
