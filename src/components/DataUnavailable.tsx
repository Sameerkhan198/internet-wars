/**
 * Shown when verified data can't be loaded (e.g. the database is paused or
 * unreachable). Deliberately shows NO numbers — never a stale or invented
 * total in place of the ledger.
 */
export default function DataUnavailable({ what = "Battle data" }: { what?: string }) {
  return (
    <div className="panel mx-auto max-w-lg my-16" role="alert">
      <div className="panel-header">
        <span className="flex items-center gap-2 text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          Feed unavailable
        </span>
        <span>Status</span>
      </div>
      <div className="p-6 text-center">
        <p className="font-semibold mb-1">{what} is temporarily unavailable.</p>
        <p className="text-sm text-muted">
          We couldn&apos;t reach the verified ledger just now, so no scores are shown. Please try again in a
          minute.
        </p>
      </div>
    </div>
  );
}

/** Runs a server data load; returns null instead of throwing when the DB is down. */
export async function loadOrNull<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[data-unavailable] ${label}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
