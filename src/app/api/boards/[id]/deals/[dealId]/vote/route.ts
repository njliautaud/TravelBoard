import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { voteDeal } from "@/lib/services/social-boards";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; dealId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { dealId } = await params;

  const body = await req.json().catch(() => ({}));
  const direction = (body as { direction?: string }).direction === "down" ? "down" as const : "up" as const;

  const result = await voteDeal(dealId, direction);
  if (!result) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  return NextResponse.json(result);
}
