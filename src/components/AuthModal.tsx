"use client";

import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/types";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: SessionUser) => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({ open, onClose, onSuccess, initialMode = "login" }: AuthModalProps) {
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-700/70 bg-slate-950 p-5 shadow-2xl"
      >
        <h2 className="mb-1 text-lg font-bold text-slate-100">
          {mode === "login" ? "Log in" : "Create account"}
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          {mode === "login"
            ? "Sign in to view and edit your personal travel map."
            : "Pick a username and password. Your wishes stay private to your account."}
        </p>
        <input
          value={username}
          autoFocus
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
        />
        <input
          type="password"
          value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
        />
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="text-xs text-slate-400 underline hover:text-slate-200"
          >
            {mode === "login" ? "Create account" : "Already have an account?"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? "Signing in…" : mode === "login" ? "Log in" : "Sign up"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
