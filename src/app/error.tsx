"use client";

import { useEffect } from "react";

/** Route-level error boundary: a calm message, never a stack trace or numbers. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-grid">
      <div className="panel max-w-md w-full" role="alert">
        <div className="panel-header">
          <span className="flex items-center gap-2 text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            Something went wrong
          </span>
          {error.digest && <span className="normal-case tracking-normal">ref {error.digest}</span>}
        </div>
        <div className="p-6 text-center">
          <p className="font-semibold mb-1">This page couldn&apos;t load.</p>
          <p className="text-sm text-muted mb-5">No scores are shown while we can&apos;t verify them. Please try again.</p>
          <button
            onClick={reset}
            className="min-h-11 px-5 rounded font-mono text-sm font-bold uppercase tracking-wider bg-foreground text-background"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
