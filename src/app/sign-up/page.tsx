// Clerk catch-all route lives at /sign-up/[[...sign-up]]/page.tsx
// This page handles the bare /sign-up path when Clerk is NOT enabled (fallback).
import Link from "next/link";

export default function SignUpFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <div className="w-full max-w-md px-4 text-center">
        <h1 className="text-2xl font-bold text-amber-400">TravelBoard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Authentication is not configured yet. Please set up Clerk keys in your environment.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block px-6 py-3 bg-amber-500 text-slate-950 font-semibold rounded-lg hover:bg-amber-400 transition"
        >
          Back to Map
        </Link>
      </div>
    </div>
  );
}
