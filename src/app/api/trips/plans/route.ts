import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listTripPlans, createTripPlan } from "@/lib/services/trip-planner";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await listTripPlans(user.id);
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
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
}
