import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/admin/stats
 * Returns system-wide stats for the admin dashboard.
 * Requires an authenticated user with OWNER role.
 */
export async function GET() {
  const sessionUser = await getAuthUser();
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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
      recentSignups,
      imageCacheCount,
      cardProfileCount,
      loyaltyBalanceCount,
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
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.imageCache.count(),
      prisma.cardProfile.count(),
      prisma.loyaltyBalance.count(),
    ]);

    // Provider status
    const hasFlightApiKey = !!process.env.FLIGHT_API_KEY;
    const hasTequilaKey = !!process.env.TEQUILA_API_KEY;
    const hasTravelpayoutsKey = !!process.env.TRAVELPAYOUTS_TOKEN;
    const hasAirlabsKey = !!process.env.AIRLABS_API_KEY;
    const flightProviderMode = process.env.FLIGHT_PROVIDER ?? (hasTravelpayoutsKey ? "aggregate" : "kiwi");

    return NextResponse.json({
      stats: {
        users: {
          total: userCount,
          recentSignups,
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
          travelpayouts: hasTravelpayoutsKey,
          airlabs: hasAirlabsKey,
          flightProviderMode,
        },
        extras: {
          imageCacheEntries: imageCacheCount,
          cardProfiles: cardProfileCount,
          loyaltyBalances: loyaltyBalanceCount,
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
