// App session, backed by Supabase Auth.
//
// Supabase Auth owns credentials/OAuth and the session cookies (set by the
// browser client + refreshed in middleware). The Prisma `User` row remains the
// app's domain record. `getSessionUser()` maps the Supabase auth identity to that
// row — creating it on first login, or *claiming* a pre-seeded username-only row
// when the email matches (how the migrated `swann`/`billyisgay` accounts attach
// to their new Supabase identities). Its `{ id, username }` shape is unchanged so
// every API route that calls it keeps working without edits.
import type { User as AuthUser } from "@supabase/supabase-js";
import { prisma } from "./prisma";
import { createClient } from "./supabase/server";

export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (u.length < 3 || u.length > 32) return "Username must be 3-32 characters";
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return "Username may only contain letters, numbers, and underscores";
  return null;
}

/** Normalize an arbitrary string into a candidate username (lowercase, safe chars). */
function slugifyUsername(raw: string): string {
  const base = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
  return base.length >= 3 ? base : `user${base}`;
}

/** Find a free username starting from `base`, suffixing -2, -3… on collisions. */
async function uniqueUsername(base: string): Promise<string> {
  const seed = slugifyUsername(base);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? seed : `${seed}${i + 1}`.slice(0, 32);
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${seed}${Date.now().toString(36)}`.slice(0, 32);
}

/**
 * Map a Supabase auth user to its Prisma row, provisioning/claiming as needed.
 * Idempotent and race-tolerant (unique-violation → re-fetch by authId).
 */
export interface AppUser {
  id: string;
  username: string;
  /** false until an OAuth signup picks a real username — drives the chooser UI. */
  usernameSet: boolean;
}

const USER_SELECT = { id: true, username: true, usernameSet: true } as const;

async function syncPrismaUser(authUser: AuthUser): Promise<AppUser> {
  // 1) Already linked.
  const linked = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: USER_SELECT,
  });
  if (linked) return linked;

  const email = authUser.email?.trim().toLowerCase() ?? null;

  // 2) Claim a pre-seeded row by email (the migrated accounts), if not yet linked.
  if (email) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { ...USER_SELECT, authId: true },
    });
    if (byEmail && !byEmail.authId) {
      const claimed = await prisma.user.update({
        where: { id: byEmail.id },
        data: { authId: authUser.id },
        select: USER_SELECT,
      });
      return claimed;
    }
  }

  // 3) Brand-new user: prefer a username chosen at sign-up (email/password stores
  //    it in metadata → considered set); OAuth has none, so derive a placeholder
  //    and mark usernameSet=false so the UI prompts them to choose one.
  const metaName = typeof authUser.user_metadata?.username === "string"
    ? (authUser.user_metadata.username as string)
    : null;
  const hasChosenName = !!metaName && !validateUsername(metaName);
  const base = hasChosenName ? metaName! : (email?.split("@")[0] ?? "traveler");
  const username = await uniqueUsername(base);

  try {
    return await prisma.user.create({
      data: { authId: authUser.id, email, username, usernameSet: hasChosenName },
      select: USER_SELECT,
    });
  } catch {
    // Lost a race (another request created it) — re-fetch by the unique authId.
    const after = await prisma.user.findUnique({
      where: { authId: authUser.id },
      select: USER_SELECT,
    });
    if (after) return after;
    throw new Error("Failed to provision user");
  }
}

/**
 * Set the signed-in user's username (the OAuth "choose a username" step).
 * Validates format + uniqueness; flips usernameSet true. Returns null if not
 * signed in, or an error string on a bad/taken name.
 */
export async function setUsername(username: string): Promise<{ user: AppUser } | { error: string }> {
  const me = await getSessionUser();
  if (!me) return { error: "Not signed in" };
  const uname = username.trim();
  const fmtErr = validateUsername(uname);
  if (fmtErr) return { error: fmtErr };
  const taken = await prisma.user.findFirst({
    where: { username: uname, NOT: { id: me.id } },
    select: { id: true },
  });
  if (taken) return { error: "Username already taken" };
  const user = await prisma.user.update({
    where: { id: me.id },
    data: { username: uname, usernameSet: true },
    select: USER_SELECT,
  });
  return { user };
}

export async function getSessionUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return syncPrismaUser(data.user);
}

/** @deprecated use getSessionUser */
export async function isEditor(): Promise<boolean> {
  return (await getSessionUser()) !== null;
}
