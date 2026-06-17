"use client";

/**
 * Safe wrappers around Clerk hooks that return fallback values
 * when ClerkProvider is not in the tree (i.e. Clerk keys not configured).
 */

import { useUser as _useUser, useAuth as _useAuth } from "@clerk/nextjs";

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

type ClerkUser = ReturnType<typeof _useUser>;
type ClerkAuth = ReturnType<typeof _useAuth>;

const FALLBACK_USER: ClerkUser = {
  isLoaded: true,
  isSignedIn: false,
  user: undefined,
} as ClerkUser;

const FALLBACK_AUTH: ClerkAuth = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
  signOut: async () => {},
  getToken: async () => null,
  has: () => false,
} as unknown as ClerkAuth;

export function useClerkUser(): ClerkUser {
  if (!CLERK_ENABLED) return FALLBACK_USER;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return _useUser();
}

export function useClerkAuth(): ClerkAuth {
  if (!CLERK_ENABLED) return FALLBACK_AUTH;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return _useAuth();
}

export { CLERK_ENABLED };
