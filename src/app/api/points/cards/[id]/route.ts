import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { updateCardProfile, deleteCardProfile } from "@/lib/services/points";


export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const card = await updateCardProfile(id, user.id, {
    cardName: body.cardName,
    issuer: body.issuer,
    pointsBalance: body.pointsBalance,
    annualFee: body.annualFee,
    category: body.category,
  });

  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ card });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteCardProfile(id, user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
