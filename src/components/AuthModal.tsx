"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: SessionUser) => void;
  initialMode?: "login" | "register";
  /** If true, user cannot dismiss — login is required */
  required?: boolean;
}

type Mode = "login" | "register" | "reset";

// Clerk-style auth card (layout mirrors ExampleImages/clerk-style.png) themed to
// match the rest of the app — dark slate surfaces, amber primary. Backed by
// Supabase Auth: email/password + Google OAuth (Apple deferred until the Apple
// Developer membership exists). Login accepts email OR username; includes a
// password-reset flow.
export default function AuthModal({ open, onClose, onSuccess, initialMode = "login", required = false }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [social, setSocial] = useState<null | "google">(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError(null);
    setNotice(null);
  }, [open, initialMode]);

  if (!open) return null;

  const supabase = createClient();
  const isRegister = mode === "register";
  const isReset = mode === "reset";
  const isLogin = mode === "login";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  // After Supabase sets the session cookie, ask the server who we are (this also
  // provisions/claims the Prisma row) and hand the app a { id, username }.
  async function finishWithServerUser() {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!data.user?.id || !data.user?.username) {
      throw new Error("Signed in, but the account could not be loaded.");
    }
    return data.user as SessionUser;
  }

  async function continueWithGoogle() {
    if (loading || social) return;
    setSocial("google");
    setError(null);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Dynamic redirect: works on localhost and on the production Vercel URL
          // with no code change — the callback route exchanges the code for a session.
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthErr) throw oauthErr;
      // On success the browser navigates away to Google; nothing more to do here.
    } catch (err) {
      setSocial(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading || social || !email.trim()) return;

    // Password reset: email a recovery link that lands on /reset-password.
    if (isReset) {
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (resetErr) throw resetErr;
        // Don't reveal whether the address exists.
        setNotice("If that email has an account, a reset link is on its way.");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (isRegister) {
        const uname = username.trim();
        if (uname.length < 3 || uname.length > 32 || !/^[a-zA-Z0-9_]+$/.test(uname)) {
          throw new Error("Username must be 3–32 letters, numbers, or underscores.");
        }
        const { data, error: signErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { username: uname },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signErr) throw signErr;
        if (!data.session) {
          // Email confirmation is enabled — no session yet.
          setNotice("Check your email to confirm your account, then sign in.");
          switchMode("login");
          setPassword("");
          return;
        }
      } else {
        // Accept email OR username: the server resolves a username to its email,
        // then signs in (server-side, so the email is never exposed to the client).
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ identifier: email.trim(), password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Sign in failed");
        }
      }
      const user = await finishWithServerUser();
      setUsername("");
      setEmail("");
      setPassword("");
      onSuccess(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none";
  const labelCls = "mb-1.5 block text-[13px] font-semibold text-slate-200";

  const heading = isReset ? "Reset your password" : isRegister ? "Create your account" : "Welcome back";
  const subtitle = isReset
    ? "Enter your email and we'll send you a reset link."
    : isRegister
      ? "Welcome! Please fill in the details to get started."
      : "Welcome back! Please sign in to continue.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !required) onClose();
      }}
    >
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl">
        <div className="px-8 pt-8 pb-6">
          {/* Icon header */}
          <div className="mb-5 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-amber-400 shadow-md ring-1 ring-slate-700">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                <path d="M12 1.5l1.6 6.3 6.3-1.6-4.7 4.7 4.7 4.7-6.3-1.6L12 22.5l-1.6-6.5-6.3 1.6 4.7-4.7-4.7-4.7 6.3 1.6L12 1.5z" />
              </svg>
            </div>
          </div>

          <h2 className="text-center text-[22px] font-bold text-slate-100">{heading}</h2>
          <p className="mt-1 text-center text-sm text-slate-400">{subtitle}</p>

          {/* Social (not on the reset screen) */}
          {!isReset && (
            <>
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={continueWithGoogle}
                  disabled={loading || !!social}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <GoogleIcon />
                  {social === "google" ? "Redirecting..." : "Continue with Google"}
                </button>
                <button
                  type="button"
                  disabled
                  title="Apple sign-in is coming soon"
                  className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-500"
                >
                  <AppleIcon />
                  Continue with Apple
                  <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Soon
                  </span>
                </button>
              </div>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-700/70" />
                <span className="text-xs font-medium text-slate-500">or</span>
                <span className="h-px flex-1 bg-slate-700/70" />
              </div>
            </>
          )}

          <form onSubmit={submit} className={`space-y-4 ${isReset ? "mt-6" : ""}`}>
            {isRegister && (
              <div>
                <label htmlFor="auth-username" className={labelCls}>Username</label>
                <input
                  id="auth-username"
                  value={username}
                  autoComplete="username"
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className={labelCls}>
                {isLogin ? "Email or username" : "Email address"}
              </label>
              <input
                id="auth-email"
                type={isLogin ? "text" : "email"}
                value={email}
                autoFocus={!isRegister}
                autoComplete={isLogin ? "username" : "email"}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isLogin ? "Email or username" : "Enter your email address"}
                className={inputCls}
              />
            </div>
            {!isReset && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="auth-password" className="text-[13px] font-semibold text-slate-200">Password</label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      className="text-xs font-medium text-amber-400 hover:text-amber-300"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={inputCls}
                />
              </div>
            )}

            {error && <p className="text-sm text-rose-400">{error}</p>}
            {notice && <p className="text-sm text-emerald-400">{notice}</p>}

            <button
              type="submit"
              disabled={loading || !!social || !email.trim() || (!isReset && !password)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? "Please wait..." : isReset ? "Send reset link" : "Continue"}
              {!loading && !isReset && <span aria-hidden>›</span>}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-900/50 px-8 py-4 text-center text-sm text-slate-400">
          {isReset ? (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="font-semibold text-amber-400 hover:text-amber-300"
            >
              ‹ Back to sign in
            </button>
          ) : (
            <>
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <button
                type="button"
                onClick={() => switchMode(isRegister ? "login" : "register")}
                className="font-semibold text-amber-400 hover:text-amber-300"
              >
                {isRegister ? "Sign in" : "Sign up"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 1.43c.09 1.04-.31 2.06-.95 2.8-.66.78-1.74 1.38-2.78 1.3-.11-1 .37-2.04.97-2.72.67-.78 1.84-1.36 2.76-1.38zM20.5 17.3c-.36.83-.53 1.2-1 1.94-.65 1.03-1.57 2.31-2.71 2.32-1.01.01-1.27-.66-2.64-.65-1.37 0-1.66.66-2.67.65-1.14-.01-2.01-1.16-2.66-2.19-1.82-2.88-2.01-6.26-.89-8.06.8-1.28 2.06-2.03 3.24-2.03 1.2 0 1.96.66 2.95.66.96 0 1.55-.66 2.94-.66 1.05 0 2.16.57 2.95 1.56-2.59 1.42-2.17 5.12.49 6.31z" />
    </svg>
  );
}
