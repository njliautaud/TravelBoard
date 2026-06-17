"use client";

import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/types";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: SessionUser) => void;
  initialMode?: "login" | "register";
  /** If true, user cannot dismiss — login is required (HC #631) */
  required?: boolean;
}

export default function AuthModal({ open, onClose, onSuccess, initialMode = "login", required = false }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError(null);
  }, [open, initialMode]);

  if (!open) return null;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || !username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (!data.user?.id || !data.user?.username) {
        throw new Error("Login succeeded but no user was returned");
      }
      const loggedInUser = data.user as SessionUser;
      setUsername("");
      setPassword("");
      onSuccess(loggedInUser);
      onClose();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !required) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-700/70 bg-slate-950 p-6 shadow-2xl animate-fade-up"
      >
        <div className="mb-4 text-center">
          <h2 className="text-xl font-bold text-amber-400 glow-text">TravelBoard</h2>
          <p className="mt-1 text-sm text-slate-400">
            {mode === "login" ? "Welcome back" : "Start your journey"}
          </p>
        </div>

        <div className="space-y-3">
          <input
            value={username}
            autoFocus
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
          />
          <input
            type="password"
            value={password}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
          />
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : mode === "login" ? "Log in" : "Create account"}
        </button>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="text-xs text-slate-400 transition hover:text-amber-300"
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 transition hover:text-slate-300"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
