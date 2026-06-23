import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { listLegs, addLeg } from "@/lib/services/trip-planner";

/**
 * GET /api/trips/plans/:id/legs
 *
 * Auth: required.
 * Lists all legs for a trip plan.
 *
 * Response: { legs: TripPlanLeg[] }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const legs = await listLegs(id, user.id);
    if (legs === null) return NextResponse.json({ error: "Plan not found", status: 404 }, { status: 404 });
    return NextResponse.json({ legs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/trips/plans/:id/legs
 *
 * Auth: required.
 * Adds a leg to a trip plan.
 *
 * Body: { origin: string, destination: string, departDate?, returnDate?, fareAmount?, fareSource?, notes? }
 * Response: { leg: TripPlanLeg }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body?.origin || !body?.destination) {
      return NextResponse.json({ error: "origin and destination are required", status: 400 }, { status: 400 });
    }

    const leg = await addLeg(id, user.id, {
      origin: body.origin,
      destination: body.destination,
      departDate: body.departDate,
      returnDate: body.returnDate,
      fareAmount: body.fareAmount,
      fareSource: body.fareSource,
      notes: body.notes,
    });

    if (!leg) return NextResponse.json({ error: "Plan not found", status: 404 }, { status: 404 });
    return NextResponse.json({ leg }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
