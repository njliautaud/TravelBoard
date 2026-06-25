"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Landing page for the password-reset email link. By the time the user gets here
// the recovery code has been exchanged for a session by /auth/callback, so we can
// set the new password with updateUser(). Same dark Clerk-style card.
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) {
      setError(
        updErr.message.toLowerCase().includes("session")
          ? "This reset link has expired or was already used. Request a new one."
          : updErr.message,
      );
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/"), 1400);
  }

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl">
        <form onSubmit={submit} className="px-8 pt-8 pb-7">
          <div className="mb-5 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-amber-400 shadow-md ring-1 ring-slate-700">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                <path d="M12 1.5l1.6 6.3 6.3-1.6-4.7 4.7 4.7 4.7-6.3-1.6L12 22.5l-1.6-6.5-6.3 1.6 4.7-4.7-4.7-4.7 6.3 1.6L12 1.5z" />
              </svg>
            </div>
          </div>
          <h2 className="text-center text-[22px] font-bold text-slate-100">Set a new password</h2>
          <p className="mt-1 text-center text-sm text-slate-400">Choose a new password for your account.</p>

          {done ? (
            <p className="mt-6 text-center text-sm text-emerald-400">
              Password updated. Taking you to the app…
            </p>
          ) : (
            <>
              <label htmlFor="new-password" className="mt-6 mb-1.5 block text-[13px] font-semibold text-slate-200">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                autoFocus
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputCls}
              />
              <label htmlFor="confirm-password" className="mt-4 mb-1.5 block text-[13px] font-semibold text-slate-200">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                className={inputCls}
              />

              {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="mt-5 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {loading ? "Saving…" : "Update password"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
