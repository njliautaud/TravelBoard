import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/analytics — lightweight event ingestion.
 *
 * Body: { event: string, props?: Record<string, unknown> }
 *
 * Fires and forgets — always returns 200 so frontend isn't blocked.
 * Events are written to the AnalyticsEvent table for later analysis.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = typeof body?.event === "string" ? body.event.slice(0, 64) : null;
    if (!eventType) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Best-effort user identification (works even if not logged in)
    let userId: string | null = null;
    try {
      const session = await getAuthUser();
      userId = session?.id ?? null;
    } catch {
      // Anonymous event — that's fine
    }

    // Sanitize payload — keep it under 4KB
    let payload: string | null = null;
    if (body.props && typeof body.props === "object") {
      const raw = JSON.stringify(body.props);
      payload = raw.length <= 4096 ? raw : raw.slice(0, 4096);
    }

    // Fire-and-forget write (don't await in hot path, but we do await here
    // since this is an API route, not a middleware)
    await prisma.analyticsEvent.create({
      data: {
        userId,
        eventType,
        payload,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Never fail the client — analytics are best-effort
    return NextResponse.json({ ok: true });
  }
}

/**
 * GET /api/analytics — admin summary of recent events.
 * Returns event counts grouped by type for the last 7 days.
 */
export async function GET() {
  const session = await getAuthUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalEvents, totalUsers, recentEvents] = await Promise.all([
    prisma.analyticsEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since }, userId: { not: null } },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["eventType"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  return NextResponse.json({
    period: "7d",
    totalEvents,
    uniqueUsers: totalUsers.length,
    byType: recentEvents.map((r) => ({
      event: r.eventType,
      count: r._count.id,
    })),
  });
}
