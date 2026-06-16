import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listComments, createComment } from "@/lib/services/social-boards";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; dealId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { dealId } = await params;
  const comments = await listComments(dealId);
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { dealId } = await params;

  const body = await req.json().catch(() => null);
  if (!body || !body.content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const comment = await createComment(dealId, user.id, body.content);
  if (!comment) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  return NextResponse.json({ comment }, { status: 201 });
}
