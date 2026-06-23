import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { listBoards, createBoard } from "@/lib/services/social-boards";

/**
 * GET /api/boards
 *
 * Auth: optional (shows public boards for unauthenticated users).
 * Lists social deal boards visible to the current user.
 *
 * Response: { boards: Board[] }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    const boards = await listBoards(user?.id);
    return NextResponse.json({ boards });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/boards
 *
 * Auth: required.
 * Creates a new social deal board.
 *
 * Body: { name: string, description?: string, isPublic?: boolean }
 * Response: { board: Board }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || !body.name?.trim()) {
      return NextResponse.json({ error: "Board name is required", status: 400 }, { status: 400 });
    }

    const board = await createBoard(user.id, body);
    return NextResponse.json({ board }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
