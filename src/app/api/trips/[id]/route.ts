import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTrip, updateTrip, deleteTrip } from "@/lib/services/trips";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/trips/[id] — get a single trip.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const trip = await getTrip(user.id, id);
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ trip });
}

/**
 * PUT /api/trips/[id] — update a trip.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Request body required" }, { status: 400 });
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

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ trip });
}

/**
 * DELETE /api/trips/[id] — delete a trip.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteTrip(user.id, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
