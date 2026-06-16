import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBoard, updateBoard, deleteBoard } from "@/lib/services/social-boards";


type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  const { id } = await params;

  const board = await getBoard(id, user?.id);
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ board });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const board = await updateBoard(id, user.id, body);
  if (!board) return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  return NextResponse.json({ board });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const deleted = await deleteBoard(id, user.id);
  if (!deleted) return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
