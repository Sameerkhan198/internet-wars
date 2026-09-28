import { NextResponse } from "next/server";

/**
 * Wraps a route handler so an unexpected failure (typically the database
 * being paused or unreachable) becomes a clean 503 JSON response instead of a
 * stack trace or HTML error page. Never substitutes data: callers get an
 * explicit "unavailable", and the client shows that instead of numbers.
 */
export function withUnavailable<Args extends unknown[]>(
  label: string,
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`[503] ${label}:`, err instanceof Error ? err.message.split("\n")[0] : err);
      return NextResponse.json(
        { error: "This is temporarily unavailable. Please try again shortly." },
        { status: 503, headers: { "retry-after": "10" } }
      );
    }
  };
}

/** Campaign statuses the public may see (drafts are admin-only). */
export const PUBLIC_STATUSES = ["SCHEDULED", "LIVE", "PAUSED", "ENDED", "CANCELLED"] as const;
