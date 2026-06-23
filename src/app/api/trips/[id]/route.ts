import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { getTrip, updateTrip, deleteTrip } from "@/lib/services/trips";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/trips/:id
 *
 * Auth: required.
 * Returns a single trip by ID.
 *
 * Response: { trip: Trip }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const trip = await getTrip(user.id, id);
    if (!trip) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });

    return NextResponse.json({ trip });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * PUT /api/trips/:id
 *
 * Auth: required.
 * Updates a trip.
 *
 * Body: { city?, country?, lat?, lon?, startDate?, endDate?, note?, rating?, coverImageUrl? }
 * Response: { trip: Trip }
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Request body required", status: 400 }, { status: 400 });
    }

    const trip = await updateTrip(user.id, id, {
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

    if (!trip) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ trip });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/trips/:id
 *
 * Auth: required.
 * Deletes a trip.
 *
 * Response: { ok: true }
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const deleted = await deleteTrip(user.id, id);
    if (!deleted) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
