"use client";

/**
 * Global error boundary — catches unhandled errors at the root level.
 * Prevents the raw "Application error: a client-side exception" page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-200">
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">TravelBoard</h1>
          <p className="text-center text-sm text-slate-400 max-w-xs">
            Something went wrong loading the app. This is usually a temporary issue.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => reset()}
              className="rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700/50"
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
