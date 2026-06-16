import { NextRequest, NextResponse } from "next/server";
import { getLoungeById } from "@/lib/services/lounges";


type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const lounge = getLoungeById(id);
  if (!lounge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lounge });
}
