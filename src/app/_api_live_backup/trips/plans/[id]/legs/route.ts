import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listLegs, addLeg } from "@/lib/services/trip-planner";


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const legs = await listLegs(id, user.id);
  if (legs === null) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ legs });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.origin || !body?.destination) {
    return NextResponse.json({ error: "origin and destination are required" }, { status: 400 });
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

  if (!leg) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ leg }, { status: 201 });
}
