import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { updateCardProfile, deleteCardProfile } from "@/lib/services/points";

/**
 * PUT /api/points/cards/:id
 *
 * Auth: required (must own the card profile).
 * Updates a credit card profile.
 *
 * Body: { cardName?, issuer?, pointsBalance?, annualFee?, category? }
 * Response: { card: CardProfile }
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

    const card = await updateCardProfile(id, user.id, {
      cardName: body.cardName,
      issuer: body.issuer,
      pointsBalance: body.pointsBalance,
      annualFee: body.annualFee,
      category: body.category,
    });

    if (!card) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ card });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/points/cards/:id
 *
 * Auth: required (must own the card profile).
 * Deletes a credit card profile.
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
    const deleted = await deleteCardProfile(id, user.id);
    if (!deleted) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
