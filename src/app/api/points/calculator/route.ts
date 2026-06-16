import { NextRequest, NextResponse } from "next/server";
import { calculatePoints } from "@/lib/services/points";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.destination) {
    return NextResponse.json({ error: "destination is required" }, { status: 400 });
  }

  const result = calculatePoints(
    body.destination,
    body.cashPrice ?? null,
    body.cabin ?? "economy",
  );

  return NextResponse.json(result);
}
