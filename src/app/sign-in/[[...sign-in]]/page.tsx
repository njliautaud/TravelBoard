"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const ClerkSignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  { ssr: false }
);

export default function SignInCatchAll() {
  if (!CLERK_ENABLED) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="w-full max-w-md px-4 text-center">
          <h1 className="text-2xl font-bold text-amber-400">TravelBoard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Authentication is not configured yet.
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

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <ClerkSignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-slate-950 border border-slate-700/70 shadow-2xl",
          },
        }}
      />
    </div>
  );
}
