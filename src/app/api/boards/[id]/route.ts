import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { getBoard, updateBoard, deleteBoard } from "@/lib/services/social-boards";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/boards/:id
 *
 * Auth: optional.
 * Returns a single board by ID with its deals.
 *
 * Response: { board: Board }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    const { id } = await params;

    const board = await getBoard(id, user?.id);
    if (!board) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ board });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * PUT /api/boards/:id
 *
 * Auth: required (must be board owner).
 * Updates a board's name, description, or visibility.
 *
 * Body: { name?: string, description?: string, isPublic?: boolean }
 * Response: { board: Board }
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON", status: 400 }, { status: 400 });

    const board = await updateBoard(id, user.id, body);
    if (!board) return NextResponse.json({ error: "Not found or unauthorized", status: 404 }, { status: 404 });
    return NextResponse.json({ board });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/boards/:id
 *
 * Auth: required (must be board owner).
 * Deletes a board and all its deals/comments.
 *
 * Response: { ok: true }
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;

    const deleted = await deleteBoard(id, user.id);
    if (!deleted) return NextResponse.json({ error: "Not found or unauthorized", status: 404 }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
