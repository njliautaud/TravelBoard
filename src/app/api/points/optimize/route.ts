import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { optimizeTransfer } from "@/lib/services/points";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.destination) {
    return NextResponse.json({ error: "destination is required" }, { status: 400 });
  }

  const result = await optimizeTransfer(
    user.id,
    body.destination,
    body.cashPrice ?? null,
    body.cabin ?? "economy",
  );

  return NextResponse.json(result);
}
