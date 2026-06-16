import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/deals/compare?origin=MCO&month=6&codes=CUN&codes=LIS
 * Compare deals for multiple destinations side by side.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin") ?? "MCO";
  const monthStr = req.nextUrl.searchParams.get("month");
  const month = monthStr ? parseInt(monthStr, 10) : new Date().getMonth();
  const codes = req.nextUrl.searchParams.getAll("codes");

  if (codes.length < 2) {
    return NextResponse.json({ error: "Need at least 2 destination codes" }, { status: 400 });
  }

  try {
    // Find cheapest fare for each destination
    const deals = await Promise.all(
      codes.map(async (code) => {
        const fare = await prisma.fareCache.findFirst({
          where: {
            origin: origin.toUpperCase(),
            flyToCode: code.toUpperCase(),
          },
          orderBy: { price: "asc" },
        });

        if (!fare) {
          return {
            code: code.toUpperCase(),
            city: null,
            country: null,
            price: null,
            baseline: null,
            dealScore: null,
            departDate: null,
            returnDate: null,
            tripDays: null,
            transfers: null,
            durationMin: null,
            deepLink: null,
            distance: null,
            missing: true,
          };
        }

        const outbound = fare.outboundDate;
        const returnD = fare.returnDate;
        const tripDays = outbound && returnD
          ? Math.round((new Date(returnD).getTime() - new Date(outbound).getTime()) / 86400000)
          : null;

        return {
          code: code.toUpperCase(),
          city: fare.destination,
          country: null,
          price: Number(fare.price),
          baseline: null,
          dealScore: fare.dealScore,
          departDate: outbound?.toISOString().slice(0, 10) ?? null,
          returnDate: returnD?.toISOString().slice(0, 10) ?? null,
          tripDays,
          transfers: null,
          durationMin: null,
          deepLink: null,
          distance: null,
          missing: false,
        };
      }),
    );

    const validDeals = deals.filter((d) => d.price != null);
    const cheapest = validDeals.length > 0
      ? validDeals.reduce((a, b) => (a.price! < b.price! ? a : b)).code
      : null;

    const bestDeal = validDeals.length > 0
      ? validDeals.reduce((a, b) => ((a.dealScore ?? 0) > (b.dealScore ?? 0) ? a : b)).code
      : null;

    return NextResponse.json({
      origin,
      month,
      deals,
      cheapest,
      bestDeal,
      count: deals.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
