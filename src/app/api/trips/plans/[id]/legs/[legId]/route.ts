import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { updateLeg, deleteLeg } from "@/lib/services/trip-planner";

/**
 * PUT /api/trips/plans/:id/legs/:legId
 *
 * Auth: required.
 * Updates a trip plan leg.
 *
 * Body: { origin?, destination?, departDate?, returnDate?, fareAmount?, fareSource?, notes?, sortOrder? }
 * Response: { leg: TripPlanLeg }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; legId: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id, legId } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON", status: 400 }, { status: 400 });

    const leg = await updateLeg(legId, id, user.id, {
      origin: body.origin,
      destination: body.destination,
      departDate: body.departDate,
      returnDate: body.returnDate,
      fareAmount: body.fareAmount,
      fareSource: body.fareSource,
      notes: body.notes,
      sortOrder: body.sortOrder,
    });

    if (!leg) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ leg });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/trips/plans/:id/legs/:legId
 *
 * Auth: required.
 * Deletes a trip plan leg.
 *
 * Response: { ok: true }
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; legId: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id, legId } = await params;
    const deleted = await deleteLeg(legId, id, user.id);
    if (!deleted) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
