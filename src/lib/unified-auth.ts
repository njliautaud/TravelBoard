/**
 * Unified auth layer: uses Supabase when configured, falls back to
 * the legacy bcrypt/cookie auth otherwise.
 *
 * All API routes should use `getAuthUser()` instead of directly
 * calling getSessionUser — this module picks the right provider
 * automatically.
 */

import { prisma } from "./prisma";

export interface AuthUser {
  id: string;        // DB user id
  username: string;
  supabaseId?: string;  // Only set when using Supabase
  imageUrl?: string | null;
  role?: string;     // UserRole from DB (OWNER, EDITOR, VIEWER)
}

const isSupabaseEnabled = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function useSupabase(): boolean {
  return isSupabaseEnabled;
}

/**
 * Get the authenticated user for the current request.
 * Works with both Supabase and legacy auth.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  if (isSupabaseEnabled) {
    return getSupabaseUser();
  }
  return getLegacyUser();
}

async function getSupabaseUser(): Promise<AuthUser | null> {
  try {
    const { createServerSupabaseClient } = await import("./supabase");
    const supabase = await createServerSupabaseClient();
    const { data: { user: supaUser } } = await supabase.auth.getUser();
    if (!supaUser) return null;

    const supabaseId = supaUser.id;

    // Find or create user in our DB linked to Supabase ID
    // externalAuthId stores the Supabase user ID
    let dbUser = await prisma.user.findFirst({
      where: { authId: supabaseId },
      select: { id: true, username: true, authId: true, imageUrl: true, role: true },
    });

    if (!dbUser) {
      const email = supaUser.email;
      const username =
        supaUser.user_metadata?.username ||
        supaUser.user_metadata?.full_name ||
        email?.split("@")[0] ||
        `user_${supabaseId.slice(-6)}`;

      dbUser = await prisma.user.create({
        data: {
          username,
          passwordHash: "", // Not used with Supabase auth
          authId: supabaseId,
          email,
          imageUrl: supaUser.user_metadata?.avatar_url ?? null,
        },
        select: { id: true, username: true, authId: true, imageUrl: true, role: true },
      });
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      supabaseId,
      imageUrl: dbUser.imageUrl,
      role: dbUser.role,
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
    // Fetch role from DB (getSessionUser doesn't include it)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    return { id: user.id, username: user.username, role: dbUser?.role };
  } catch {
    return null;
  }
}
