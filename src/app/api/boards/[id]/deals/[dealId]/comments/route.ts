import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { listComments, createComment } from "@/lib/services/social-boards";

type Params = { params: Promise<{ id: string; dealId: string }> };

/**
 * GET /api/boards/:id/deals/:dealId/comments
 *
 * Auth: none (public).
 * Lists all comments on a deal.
 *
 * Response: { comments: BoardComment[] }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { dealId } = await params;
    const comments = await listComments(dealId);
    return NextResponse.json({ comments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/boards/:id/deals/:dealId/comments
 *
 * Auth: required.
 * Adds a comment to a deal.
 *
 * Body: { content: string }
 * Response: { comment: BoardComment }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { dealId } = await params;

    const body = await req.json().catch(() => null);
    if (!body || !body.content?.trim()) {
      return NextResponse.json({ error: "Content is required", status: 400 }, { status: 400 });
    }

    const comment = await createComment(dealId, user.id, body.content);
    if (!comment) return NextResponse.json({ error: "Deal not found", status: 404 }, { status: 404 });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
