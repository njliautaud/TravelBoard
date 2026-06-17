"use client";

import { CLERK_ENABLED } from "@/lib/useClerkSafe";

/**
 * Lazy-loads UserButton from @clerk/nextjs only when Clerk is enabled.
 * Returns null otherwise — avoids importing Clerk components when provider is absent.
 */

import dynamic from "next/dynamic";

const UserButtonInner = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  { ssr: false }
);

interface Props {
  appearance?: Record<string, unknown>;
}

export default function ClerkUserButton({ appearance }: Props) {
  if (!CLERK_ENABLED) return null;
  return <UserButtonInner appearance={appearance} />;
}
