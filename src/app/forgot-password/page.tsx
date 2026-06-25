"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check URL for token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
      setStep("reset");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      // If token was returned (no email service), auto-fill it
      if (data.token) {
        setToken(data.token);
        setStep("reset");
      } else {
        setStep("done");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setStep("done");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <div className="w-full max-w-md px-4">
        <div className="rounded-xl border border-slate-700/70 bg-slate-950 p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-amber-400 text-center">
            TravelBoard
          </h1>

          {step === "request" && (
            <>
              <p className="mt-2 text-sm text-slate-400 text-center">
                Enter your username to reset your password
              </p>
              <form onSubmit={handleRequestReset} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Your username"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400 transition disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Reset Password"}
                </button>
              </form>
            </>
          )}

          {step === "reset" && (
            <>
              <p className="mt-2 text-sm text-slate-400 text-center">
                Enter your new password
              </p>
              <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={4}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="New password"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={4}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Confirm new password"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400 transition disabled:opacity-50"
                >
                  {loading ? "Resetting..." : "Set New Password"}
                </button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="mt-6 text-center">
              <p className="text-green-400">
                {token
                  ? "Password reset successfully!"
                  : "If that account exists, check for a reset link."}
              </p>
              <Link
                href="/sign-in"
                className="mt-4 inline-block px-6 py-2 bg-amber-500 text-slate-950 font-semibold rounded-lg hover:bg-amber-400 transition"
              >
                Sign In
              </Link>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/sign-in"
              className="text-sm text-slate-400 hover:text-amber-400 transition"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
