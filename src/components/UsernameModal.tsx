"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/types";

// Shown after an OAuth (Google) signup that has no username yet. Same Clerk-style
// aesthetic as the auth card. Cannot be dismissed without choosing — the app
// needs a username for friends/public profiles.
export default function UsernameModal({
  suggested,
  onDone,
}: {
  suggested?: string;
  onDone: (user: SessionUser) => void;
}) {
  const [username, setUsername] = useState(suggested ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const uname = username.trim();
    if (loading || !uname) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: uname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not set username");
      onDone(data.user as SessionUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl">
        <form onSubmit={submit} className="px-8 pt-8 pb-7">
          <div className="mb-5 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-amber-400 shadow-md ring-1 ring-slate-700">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                <path d="M12 1.5l1.6 6.3 6.3-1.6-4.7 4.7 4.7 4.7-6.3-1.6L12 22.5l-1.6-6.5-6.3 1.6 4.7-4.7-4.7-4.7 6.3 1.6L12 1.5z" />
              </svg>
            </div>
          </div>
          <h2 className="text-center text-[22px] font-bold text-slate-100">Choose a username</h2>
          <p className="mt-1 text-center text-sm text-slate-400">
            This is how friends find you. You can pick anything available.
          </p>

          <label htmlFor="choose-username" className="mt-6 mb-1.5 block text-[13px] font-semibold text-slate-200">
            Username
          </label>
          <input
            id="choose-username"
            value={username}
            autoFocus
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter a username"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-slate-500">3–32 letters, numbers, or underscores.</p>

          {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Continue"}
            {!loading && <span aria-hidden>›</span>}
          </button>
        </form>
      </div>
    </div>
  );
}
