import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { listTrips, createTrip } from "@/lib/services/trips";

/**
 * GET /api/trips
 *
 * Auth: required.
 * Lists all trips for the authenticated user.
 *
 * Response: { trips: Trip[] }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const trips = await listTrips(user.id);
    return NextResponse.json({ trips });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/trips
 *
 * Auth: required.
 * Creates a new trip.
 *
 * Body: { code: string, city: string, country: string, lat: number, lon: number, startDate?, endDate?, note?, rating?, coverImageUrl? }
 * Response: { trip: Trip }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.code || !body?.city || !body?.country || body?.lat == null || body?.lon == null) {
      return NextResponse.json(
        { error: "code, city, country, lat, and lon are required", status: 400 },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
