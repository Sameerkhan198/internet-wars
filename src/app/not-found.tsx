import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-grid">
      <div className="panel max-w-md w-full">
        <div className="panel-header">
          <span className="text-foreground">404</span>
          <span>Not found</span>
        </div>
        <div className="p-6 text-center">
          <p className="font-semibold mb-1">There&apos;s nothing at this address.</p>
          <p className="text-sm text-muted mb-5">It may have moved, or the battle may not exist.</p>
          <Link
            href="/"
            className="inline-flex items-center min-h-11 px-5 rounded font-mono text-sm font-bold uppercase tracking-wider bg-foreground text-background"
          >
            Back to the battle
          </Link>
        </div>
      </div>
    </main>
  );
}
