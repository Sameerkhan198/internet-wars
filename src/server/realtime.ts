import { EventEmitter } from "events";

/**
 * In-memory pub/sub for live scoreboard + activity updates. Fine for a
 * single-process deployment (the MVP target); swap for Redis pub/sub if this
 * ever runs across multiple server instances.
 */
class Broadcaster extends EventEmitter {}

const globalForRealtime = globalThis as unknown as { broadcaster?: Broadcaster };
export const broadcaster = globalForRealtime.broadcaster ?? new Broadcaster();
broadcaster.setMaxListeners(0);
if (process.env.NODE_ENV !== "production") globalForRealtime.broadcaster = broadcaster;

export type ScoreUpdateEvent = {
  type: "SCORE_UPDATE";
  campaignId: string;
  teamATotal: number;
  teamBTotal: number;
  teamAPercentage: number;
  teamBPercentage: number;
  teamASupporters: number;
  teamBSupporters: number;
  leaderTeamId: string | null;
  differenceAmount: number;
};

export type ActivityFeedEvent = {
  type: "ACTIVITY";
  campaignId: string;
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
};

export type RealtimeEvent = ScoreUpdateEvent | ActivityFeedEvent;

export function publish(campaignId: string, event: RealtimeEvent) {
  broadcaster.emit(`campaign:${campaignId}`, event);
}

export function subscribe(campaignId: string, handler: (event: RealtimeEvent) => void) {
  const channel = `campaign:${campaignId}`;
  broadcaster.on(channel, handler);
  return () => broadcaster.off(channel, handler);
}
