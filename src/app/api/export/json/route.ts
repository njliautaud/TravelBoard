import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/export/json
 *
 * Auth: required.
 * Downloads all user data as JSON file.
 *
 * Response: application/json file download
 */
export async function GET() {
  try {
    const session = await getAuthUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    }

    const [locations, trips, tripPlans, journalEntries, watches, cards, loyalty] =
      await Promise.all([
        prisma.location.findMany({
          where: { userId: session.id },
          include: { media: true, flightPrices: true },
        }),
        prisma.trip.findMany({ where: { userId: session.id } }),
        prisma.tripPlan.findMany({
          where: { userId: session.id },
          include: { legs: true },
        }),
        prisma.journalEntry.findMany({ where: { userId: session.id } }),
        prisma.watch.findMany({
          where: { userId: session.id },
          include: { alerts: true },
        }),
        prisma.cardProfile.findMany({ where: { userId: session.id } }),
        prisma.loyaltyBalance.findMany({ where: { userId: session.id } }),
      ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: session.username,
      locations,
      trips,
      tripPlans,
      journalEntries,
      watches,
      cardProfiles: cards,
      loyaltyBalances: loyalty,
    };

    const blob = JSON.stringify(exportData, null, 2);

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="travelboard-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
