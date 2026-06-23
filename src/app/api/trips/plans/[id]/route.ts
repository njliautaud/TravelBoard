import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { getTripPlan, updateTripPlan, deleteTripPlan } from "@/lib/services/trip-planner";

/**
 * GET /api/trips/plans/:id
 *
 * Auth: required.
 * Returns a single trip plan with its legs.
 *
 * Response: { plan: TripPlan }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const plan = await getTripPlan(id, user.id);
    if (!plan) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * PUT /api/trips/plans/:id
 *
 * Auth: required.
 * Updates a trip plan.
 *
 * Body: { name?, description?, startDate?, endDate?, budget?, currency?, status? }
 * Response: { plan: TripPlan }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON", status: 400 }, { status: 400 });

    const plan = await updateTripPlan(id, user.id, {
      name: body.name,
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      budget: body.budget,
      currency: body.currency,
      status: body.status,
    });

    if (!plan) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/trips/plans/:id
 *
 * Auth: required.
 * Deletes a trip plan and all its legs.
 *
 * Response: { ok: true }
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const deleted = await deleteTripPlan(id, user.id);
    if (!deleted) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
