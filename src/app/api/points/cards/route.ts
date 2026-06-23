import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { listCardProfiles, createCardProfile } from "@/lib/services/points";

/**
 * GET /api/points/cards
 *
 * Auth: required.
 * Lists all credit card profiles for the current user.
 *
 * Response: { cards: CardProfile[] }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const cards = await listCardProfiles(user.id);
    return NextResponse.json({ cards });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/points/cards
 *
 * Auth: required.
 * Adds a new credit card profile.
 *
 * Body: { cardName: string, issuer?: string, pointsBalance?: number, annualFee?: number, category?: string }
 * Response: { card: CardProfile }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.cardName) {
      return NextResponse.json({ error: "cardName is required", status: 400 }, { status: 400 });
    }

    const card = await createCardProfile(user.id, {
      cardName: body.cardName,
      issuer: body.issuer,
      pointsBalance: body.pointsBalance,
      annualFee: body.annualFee,
      category: body.category,
    });

    return NextResponse.json({ card }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
