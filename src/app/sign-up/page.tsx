"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<null | "google">(null);

  async function handleGoogleSignUp() {
    if (loading || socialLoading) return;
    setSocialLoading("google");
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthErr) throw oauthErr;
      // Browser navigates away to Google on success
    } catch (err) {
      setSocialLoading(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
      } else {
        // If email confirmation is required, show success message.
        // Otherwise redirect to home.
        setSuccess(true);
        // Try auto-login in case email confirmation is disabled
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!loginErr) {
          router.push("/");
          router.refresh();
        }
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="w-full max-w-sm mx-4">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950 p-8 shadow-2xl text-center">
            <h1 className="text-2xl font-bold text-amber-400">Check your email</h1>
            <p className="mt-3 text-sm text-slate-400">
              We sent a confirmation link to <strong className="text-slate-200">{email}</strong>.
              Click it to activate your account.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 inline-block rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950 p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-amber-400">TravelBoard</h1>
            <p className="mt-1 text-sm text-slate-400">Create your account</p>
          </div>

          {/* Google OAuth — primary sign-up method */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading || !!socialLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
            >
              <GoogleIcon />
              {socialLoading === "google" ? "Redirecting..." : "Create account with Google"}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Confirm your password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !!socialLoading}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            By signing up, you agree to our{" "}
            <Link href="/terms" className="text-amber-400/80 underline decoration-amber-400/30 hover:text-amber-400">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-amber-400/80 underline decoration-amber-400/30 hover:text-amber-400">
              Privacy Policy
            </Link>.
          </p>

          <div className="mt-3 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-amber-400 hover:text-amber-300">
              Sign in
            </Link>
          </div>
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
