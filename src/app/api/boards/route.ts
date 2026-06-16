import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listBoards, createBoard } from "@/lib/services/social-boards";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  const boards = await listBoards(user?.id);
  return NextResponse.json({ boards });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.name?.trim()) {
    return NextResponse.json({ error: "Board name is required" }, { status: 400 });
  }

  const board = await createBoard(user.id, body);
  return NextResponse.json({ board }, { status: 201 });
}
