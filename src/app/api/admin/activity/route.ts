import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/activity
 * Returns a unified timeline of recent activity across the app.
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
    // Fetch recent activity from multiple tables in parallel
    const [
      analyticsEvents,
      recentLocations,
      recentJournals,
      recentWatches,
      recentSignups,
      recentDeals,
    ] = await Promise.all([
      // Recent analytics events (searches, etc.)
      prisma.analyticsEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          userId: true,
          eventType: true,
          payload: true,
          createdAt: true,
        },
      }),

      // Recent locations added
      prisma.location.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          activityName: true,
          countryName: true,
          city: true,
          status: true,
          userId: true,
          createdAt: true,
          user: { select: { username: true, imageUrl: true } },
        },
      }),

      // Recent journal entries
      prisma.journalEntry.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          location: true,
          country: true,
          userId: true,
          createdAt: true,
          user: { select: { username: true, imageUrl: true } },
        },
      }),

      // Recent watches created
      prisma.watch.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          origin: true,
          destinationCode: true,
          targetPrice: true,
          userId: true,
          createdAt: true,
          user: { select: { username: true, imageUrl: true } },
        },
      }),

      // Recent user signups
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          username: true,
          imageUrl: true,
          createdAt: true,
        },
      }),

      // Recent board deals saved
      prisma.boardDeal.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          origin: true,
          destination: true,
          price: true,
          currency: true,
          userId: true,
          createdAt: true,
          user: { select: { username: true, imageUrl: true } },
        },
      }),
    ]);

    // Build a user lookup for analytics events (they only have userId, no relation)
    const analyticsUserIds = analyticsEvents
      .map((e) => e.userId)
      .filter((id): id is string => id !== null);
    const analyticsUsers =
      analyticsUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: analyticsUserIds } },
            select: { id: true, username: true, imageUrl: true },
          })
        : [];
    const userMap = new Map(analyticsUsers.map((u) => [u.id, u]));

    // Unify into a single timeline
    type TimelineEvent = {
      id: string;
      type: string;
      username: string | null;
      userImage: string | null;
      timestamp: string;
      details: string;
    };

    const timeline: TimelineEvent[] = [];

    // Analytics events
    for (const ev of analyticsEvents) {
      const user = ev.userId ? userMap.get(ev.userId) : null;
      let details = ev.eventType;
      if (ev.payload) {
        try {
          const p = JSON.parse(ev.payload);
          if (p.query) details = `Searched: "${p.query}"`;
          else if (p.origin) details = `Search from ${p.origin}`;
          else details = ev.eventType;
        } catch {
          details = ev.eventType;
        }
      }
      timeline.push({
        id: ev.id,
        type: ev.eventType === "search" ? "search" : ev.eventType,
        username: user?.username ?? null,
        userImage: user?.imageUrl ?? null,
        timestamp: ev.createdAt.toISOString(),
        details,
      });
    }

    // Locations
    for (const loc of recentLocations) {
      const where = [loc.city, loc.countryName].filter(Boolean).join(", ");
      timeline.push({
        id: loc.id,
        type: "location_added",
        username: loc.user.username,
        userImage: loc.user.imageUrl,
        timestamp: loc.createdAt.toISOString(),
        details: `Added "${loc.activityName}" in ${where}`,
      });
    }

    // Journals
    for (const j of recentJournals) {
      const where = [j.location, j.country].filter(Boolean).join(", ");
      timeline.push({
        id: j.id,
        type: "journal_entry",
        username: j.user.username,
        userImage: j.user.imageUrl,
        timestamp: j.createdAt.toISOString(),
        details: `Wrote "${j.title}"${where ? ` about ${where}` : ""}`,
      });
    }

    // Watches
    for (const w of recentWatches) {
      timeline.push({
        id: w.id,
        type: "watch_created",
        username: w.user.username,
        userImage: w.user.imageUrl,
        timestamp: w.createdAt.toISOString(),
        details: `Watching ${w.origin} to ${w.destinationCode} under $${w.targetPrice}`,
      });
    }

    // Signups
    for (const u of recentSignups) {
      timeline.push({
        id: u.id,
        type: "signup",
        username: u.username,
        userImage: u.imageUrl,
        timestamp: u.createdAt.toISOString(),
        details: `${u.username} joined TravelBoard`,
      });
    }

    // Deals
    for (const d of recentDeals) {
      timeline.push({
        id: d.id,
        type: "deal_saved",
        username: d.user.username,
        userImage: d.user.imageUrl,
        timestamp: d.createdAt.toISOString(),
        details: `Posted deal: ${d.origin} to ${d.destination} for ${d.currency} ${d.price}`,
      });
    }

    // Sort by timestamp descending and take top 50
    timeline.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const events = timeline.slice(0, 50);

    // Summary counts
    const summary = {
      totalEvents: timeline.length,
      searches: analyticsEvents.filter((e) => e.eventType === "search").length,
      signups: recentSignups.length,
      locationsAdded: recentLocations.length,
      journalEntries: recentJournals.length,
      watchesCreated: recentWatches.length,
      dealsSaved: recentDeals.length,
    };

    return NextResponse.json({ events, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
