"use client";

import { useSupabaseUser, useSupabaseAuthActions } from "@/lib/useSupabaseAuth";

/**
 * User avatar button — shows first letter of email and sign-out on click.
 * Uses Supabase auth directly.
 */

interface Props {
  appearance?: Record<string, unknown>;
}

export default function UserButton({ appearance: _appearance }: Props) {
  const { user } = useSupabaseUser();
  const { signOut } = useSupabaseAuthActions();

  if (!user) return null;

  const initial = (user.email?.[0] ?? "U").toUpperCase();

  return (
    <button
      onClick={() => signOut()}
      title={`Signed in as ${user.email ?? "user"} — click to sign out`}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400 transition hover:bg-amber-500/30"
    >
      {initial}
    </button>
  );
}
