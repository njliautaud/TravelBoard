import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { listTripPlans, createTripPlan } from "@/lib/services/trip-planner";

/**
 * GET /api/trips/plans
 *
 * Auth: required.
 * Lists all trip plans for the current user.
 *
 * Response: { plans: TripPlan[] }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const plans = await listTripPlans(user.id);
    return NextResponse.json({ plans });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/trips/plans
 *
 * Auth: required.
 * Creates a new trip plan.
 *
 * Body: { name: string, description?, startDate?, endDate?, budget?, currency?, status? }
 * Response: { plan: TripPlan }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.name) {
      return NextResponse.json({ error: "name is required", status: 400 }, { status: 400 });
    }

    const plan = await createTripPlan(user.id, {
      name: body.name,
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      budget: body.budget,
      currency: body.currency,
      status: body.status,
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
