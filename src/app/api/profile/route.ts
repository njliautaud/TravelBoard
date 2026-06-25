import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/profile — returns user profile stats for the UserProfile component.
 */
export async function GET() {
  const session = await getAuthUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      username: true,
      email: true,
      homeAirports: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Gather stats in parallel
  const [tripCount, journalEntries, savedDeals, countriesVisited, gamification] =
    await Promise.all([
      prisma.trip.count({ where: { userId: session.id } }),
      prisma.journalEntry.count({ where: { userId: session.id } }),
      prisma.location.count({ where: { userId: session.id, starred: true } }),
      prisma.trip
        .findMany({
          where: { userId: session.id },
          select: { country: true },
          distinct: ["country"],
        })
        .then((r) => r.length),
      prisma.gamificationProgress.findUnique({
        where: { userId: session.id },
        select: { totalPoints: true, level: true, badges: true },
      }),
    ]);

  const homeAirports: string[] = user.homeAirports ?? [];

  let badges: string[] = [];
  try {
    badges = gamification?.badges ? JSON.parse(gamification.badges) : [];
  } catch {
    badges = [];
  }

  return NextResponse.json({
    username: user.username,
    email: user.email,
    homeAirports,
    memberSince: user.createdAt.toISOString(),
    tripCount,
    countriesVisited,
    journalEntries,
    savedDeals,
    totalPoints: gamification?.totalPoints ?? 0,
    level: gamification?.level ?? 1,
    badges,
  });
}
