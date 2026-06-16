import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listDeals, createDeal } from "@/lib/services/social-boards";


type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const deals = await listDeals(id);
  return NextResponse.json({ deals });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body || !body.origin || !body.destination || body.price == null) {
    return NextResponse.json({ error: "origin, destination, and price are required" }, { status: 400 });
  }

  const deal = await createDeal(id, user.id, body);
  if (!deal) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  return NextResponse.json({ deal }, { status: 201 });
}
