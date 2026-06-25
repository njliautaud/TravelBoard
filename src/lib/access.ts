import { prisma } from "./prisma";

/** Accepted-friendship check (true for self). */
export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const f = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return f !== null;
}

/**
 * Can `viewerId` (null = logged-out) see `targetId`'s FULL board? Boards are
 * private: only the owner or an accepted friend. Public visibility is per-spot
 * (Location.isPublic) via the public feed, never the whole board.
 */
export async function canViewBoard(viewerId: string | null, targetId: string): Promise<boolean> {
  if (!viewerId) return false;
  return areFriends(viewerId, targetId);
}
