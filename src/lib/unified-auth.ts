/**
 * Unified auth layer: uses Clerk when CLERK keys are configured,
 * falls back to the legacy bcrypt/cookie auth otherwise.
 *
 * All API routes should use `getAuthUser()` instead of directly
 * calling getSessionUser or Clerk's auth() — this module picks
 * the right provider automatically.
 */

import { prisma } from "./prisma";

export interface AuthUser {
  id: string;        // DB user id
  username: string;
  clerkId?: string;  // Only set when using Clerk
  imageUrl?: string | null; // Clerk profile image
}

const isClerkEnabled = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY
);

export function useClerk(): boolean {
  return isClerkEnabled;
}

/**
 * Get the authenticated user for the current request.
 * Works with both Clerk and legacy auth.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  if (isClerkEnabled) {
    return getClerkUser();
  }
  return getLegacyUser();
}

async function getClerkUser(): Promise<AuthUser | null> {
  try {
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (!userId) return null;

    // Find or create user in our DB linked to Clerk ID
    let dbUser = await prisma.user.findFirst({
      where: { clerkId: userId },
      select: { id: true, username: true, clerkId: true, imageUrl: true },
    });

    if (!dbUser) {
      const clerkUser = await currentUser();
      const username =
        clerkUser?.username ||
        clerkUser?.firstName ||
        clerkUser?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
        `user_${userId.slice(-6)}`;

      dbUser = await prisma.user.create({
        data: {
          username,
          passwordHash: "", // Not used with Clerk
          clerkId: userId,
          imageUrl: clerkUser?.imageUrl,
        },
        select: { id: true, username: true, clerkId: true, imageUrl: true },
      });
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      clerkId: userId,
      imageUrl: dbUser.imageUrl,
    };
  } catch {
    return null;
  }
}

async function getLegacyUser(): Promise<AuthUser | null> {
  try {
    const { getSessionUser } = await import("./auth");
    const user = await getSessionUser();
    if (!user) return null;
    return { id: user.id, username: user.username };
  } catch {
    return null;
  }
}
