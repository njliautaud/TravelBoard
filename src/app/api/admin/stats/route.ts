import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stats
 * Returns system-wide stats for the admin dashboard.
 * Requires an authenticated user with OWNER role.
 */
export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for OWNER role
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  });

  if (dbUser?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Run all queries in parallel
    const [
      userCount,
      locationCount,
      watchCount,
      activeWatchCount,
      journalCount,
      tripCount,
      fareCount,
      oldestFare,
      newestFare,
      analyticsCount,
      searchEvents,
      boardCount,
      boardDealCount,
      // Per-origin fare coverage
      fareCoverage,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.location.count(),
      prisma.watch.count(),
      prisma.watch.count({ where: { active: true } }),
      prisma.journalEntry.count(),
      prisma.trip.count(),
      prisma.fareCache.count(),
      prisma.fareCache.findFirst({ orderBy: { lastSeen: "asc" }, select: { lastSeen: true } }),
      prisma.fareCache.findFirst({ orderBy: { lastSeen: "desc" }, select: { lastSeen: true } }),
      prisma.analyticsEvent.count(),
      prisma.analyticsEvent.count({ where: { eventType: "search" } }),
      prisma.socialBoard.count(),
      prisma.boardDeal.count(),
      prisma.fareCache.groupBy({
        by: ["origin"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 20,
      }),
    ]);

    // Provider status
    const hasFlightApiKey = !!process.env.FLIGHT_API_KEY;
    const hasTequilaKey = !!process.env.TEQUILA_API_KEY;
    const hasAirlabsKey = !!process.env.AIRLABS_API_KEY;

    return NextResponse.json({
      stats: {
        users: {
          total: userCount,
        },
        content: {
          locations: locationCount,
          journals: journalCount,
          trips: tripCount,
          boards: boardCount,
          boardDeals: boardDealCount,
        },
        watches: {
          total: watchCount,
          active: activeWatchCount,
        },
        cache: {
          totalFares: fareCount,
          oldestEntry: oldestFare?.lastSeen?.toISOString() ?? null,
          newestEntry: newestFare?.lastSeen?.toISOString() ?? null,
          coverageByOrigin: fareCoverage.map((fc) => ({
            origin: fc.origin,
            count: fc._count.id,
          })),
        },
        analytics: {
          totalEvents: analyticsCount,
          searches: searchEvents,
        },
        providers: {
          flightApi: hasFlightApiKey,
          tequila: hasTequilaKey,
          airlabs: hasAirlabsKey,
        },
        database: {
          status: "connected",
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message, stats: { database: { status: "error" } } },
      { status: 500 },
    );
  }
}
