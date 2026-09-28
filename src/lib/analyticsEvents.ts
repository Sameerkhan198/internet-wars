import { z } from "zod";
import { SHARE_CHANNELS } from "@/lib/share";

/**
 * The complete, allow-listed set of product analytics events and the only
 * properties each may carry. Shared by the client helper and the /api/events
 * endpoint (which rejects anything else). Deliberately no free text, no names,
 * no emails, no amounts beyond a coarse bucket.
 */
const side = z.enum(["a", "b"]);
export const AMOUNT_BUCKETS = ["10", "50", "100", "500", "1000", "custom"] as const;
const bucket = z.enum(AMOUNT_BUCKETS);

export const EVENT_SCHEMAS = {
  page_view: z.object({ page: z.enum(["battle", "leaderboard", "history"]), returning: z.boolean() }),
  side_selected: z.object({ side }),
  contribution_flow_opened: z.object({ side }),
  amount_selected: z.object({ side, bucket }),
  demo_contribution_started: z.object({ side, bucket, anonymous: z.boolean() }),
  demo_contribution_completed: z.object({ side, outcome: z.enum(["success", "failed"]) }),
  share_clicked: z.object({ channel: z.enum(SHARE_CHANNELS) }),
  leaderboard_viewed: z.object({}),
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;
export type EventProps<N extends EventName> = z.infer<(typeof EVENT_SCHEMAS)[N]>;

export const EVENT_NAMES = Object.keys(EVENT_SCHEMAS) as EventName[];

export function amountBucket(rupees: number, isQuick: boolean): (typeof AMOUNT_BUCKETS)[number] {
  const s = String(rupees);
  return isQuick && (AMOUNT_BUCKETS as readonly string[]).includes(s) ? (s as (typeof AMOUNT_BUCKETS)[number]) : "custom";
}
