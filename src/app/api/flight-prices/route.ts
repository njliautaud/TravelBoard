import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-utils";


/**
 * POST /api/flight-prices
 *
 * Auth: API key via X-API-Key header (FLIGHT_API_KEY env var).
 * Used by external scripts to push flight price data.
 *
 * Body: { locationId: string, price: number, currency?: string,
 *         origin?: string, destination?: string, source?: string }
 * Response: { ok: true, id, locationId, isDeal, threshold }
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req, "x-api-key", "FLIGHT_API_KEY")) {
    return NextResponse.json(
      { error: "Invalid or missing X-API-Key", status: 401 },
      { status: 401 },
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body?.locationId || typeof body.price !== "number" || body.price < 0) {
      return NextResponse.json(
        { error: "Body must include locationId (string) and price (non-negative number)", status: 400 },
        { status: 400 },
      );
    }

    const location = await prisma.location.findUnique({ where: { id: body.locationId } });
    if (!location) {
      return NextResponse.json(
        { error: `No location with id ${body.locationId}`, status: 404 },
        { status: 404 },
      );
    }

    const created = await prisma.flightPrice.create({
      data: {
        locationId: location.id,
        price: body.price,
        currency: typeof body.currency === "string" ? body.currency.toUpperCase() : "USD",
        origin: typeof body.origin === "string" ? body.origin : null,
        destination: typeof body.destination === "string" ? body.destination : null,
        source: typeof body.source === "string" ? body.source : null,
      },
    });

    const threshold = location.priceThreshold === null ? null : Number(location.priceThreshold);
    const isDeal = threshold !== null && body.price <= threshold;

    return NextResponse.json(
      { ok: true, id: created.id, locationId: location.id, isDeal, threshold },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * GET /api/flight-prices?locationId=...
 *
 * Auth: none (public).
 * Returns price history for a location, newest first.
 *
 * Query: locationId (required)
 * Response: { prices: Array<{ id, price, currency, origin, destination, source, fetchedAt }> }
 */
export async function GET(req: NextRequest) {
  try {
    const locationId = new URL(req.url).searchParams.get("locationId");
    if (!locationId) {
      return NextResponse.json(
        { error: "locationId query param required", status: 400 },
        { status: 400 },
      );
    }

    const prices = await prisma.flightPrice.findMany({
      where: { locationId },
      orderBy: { fetchedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      prices: prices.map((p) => ({
        id: p.id,
        price: Number(p.price),
        currency: p.currency,
        origin: p.origin,
        destination: p.destination,
        source: p.source,
        fetchedAt: p.fetchedAt.toISOString(),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
