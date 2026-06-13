import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function hasValidApiKey(req: NextRequest): boolean {
  const key = process.env.FLIGHT_API_KEY;
  return Boolean(key) && req.headers.get("x-api-key") === key;
}

/**
 * POST /api/flight-prices
 * For the partner's Python script. Requires the X-API-Key header.
 * Body: { "locationId": "...", "price": 589.0, "currency": "USD",
 *         "origin": "SEA", "destination": "CUZ", "source": "my-script" }
 */
export async function POST(req: NextRequest) {
  if (!hasValidApiKey(req)) {
    return NextResponse.json({ error: "Invalid or missing X-API-Key" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.locationId || typeof body.price !== "number" || body.price < 0) {
    return NextResponse.json(
      { error: "Body must include locationId (string) and price (non-negative number)" },
      { status: 400 }
    );
  }
  const location = await prisma.location.findUnique({ where: { id: body.locationId } });
  if (!location) {
    return NextResponse.json({ error: `No location with id ${body.locationId}` }, { status: 404 });
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
    {
      ok: true,
      id: created.id,
      locationId: location.id,
      isDeal,
      threshold,
    },
    { status: 201 }
  );
}

/** GET /api/flight-prices?locationId=...  — price history (public, newest first) */
export async function GET(req: NextRequest) {
  const locationId = new URL(req.url).searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId query param required" }, { status: 400 });
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
}
