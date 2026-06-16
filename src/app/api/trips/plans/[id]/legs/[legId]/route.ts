import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { updateLeg, deleteLeg } from "@/lib/services/trip-planner";


export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; legId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, legId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

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

  if (!leg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ leg });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; legId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, legId } = await params;
  const deleted = await deleteLeg(legId, id, user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
