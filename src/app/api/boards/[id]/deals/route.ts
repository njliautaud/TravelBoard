import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { listDeals, createDeal } from "@/lib/services/social-boards";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/boards/:id/deals
 *
 * Auth: none (public).
 * Lists all deals posted to a board.
 *
 * Response: { deals: BoardDeal[] }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const deals = await listDeals(id);
    return NextResponse.json({ deals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/boards/:id/deals
 *
 * Auth: required.
 * Adds a deal to a board.
 *
 * Body: { origin: string, destination: string, price: number, ... }
 * Response: { deal: BoardDeal }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || !body.origin || !body.destination || body.price == null) {
      return NextResponse.json({ error: "origin, destination, and price are required", status: 400 }, { status: 400 });
    }

    const deal = await createDeal(id, user.id, body);
    if (!deal) return NextResponse.json({ error: "Board not found", status: 404 }, { status: 404 });
    return NextResponse.json({ deal }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
