import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listTrips, createTrip } from "@/lib/services/trips";

export const dynamic = "force-dynamic";

/**
 * GET /api/trips — list all trips for the authenticated user.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trips = await listTrips(user.id);
  return NextResponse.json({ trips });
}

/**
 * POST /api/trips — add a new trip.
 *
 * Body: { code, city, country, lat, lon, startDate?, endDate?, note?, rating? }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.code || !body?.city || !body?.country || body?.lat == null || body?.lon == null) {
    return NextResponse.json(
      { error: "code, city, country, lat, and lon are required" },
      { status: 400 },
    );
  }

  const trip = await createTrip(user.id, {
    code: body.code,
    city: body.city,
    country: body.country,
    lat: body.lat,
    lon: body.lon,
    startDate: body.startDate,
    endDate: body.endDate,
    note: body.note,
    rating: body.rating,
    coverImageUrl: body.coverImageUrl,
  });

  return NextResponse.json({ trip }, { status: 201 });
}
