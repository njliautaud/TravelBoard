import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { voteDeal } from "@/lib/services/social-boards";

type Params = { params: Promise<{ id: string; dealId: string }> };

/**
 * POST /api/boards/:id/deals/:dealId/vote
 *
 * Auth: required.
 * Votes a deal up or down.
 *
 * Body: { direction?: "up" | "down" }
 * Response: { upvotes, downvotes }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { dealId } = await params;

    const body = await req.json().catch(() => ({}));
    const direction = (body as { direction?: string }).direction === "down" ? "down" as const : "up" as const;

    const result = await voteDeal(dealId, direction);
    if (!result) return NextResponse.json({ error: "Deal not found", status: 404 }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
