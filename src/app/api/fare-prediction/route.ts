import { NextRequest, NextResponse } from "next/server";
import { predictFare } from "@/lib/services/fare-prediction";


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.origin || !body?.destination) {
    return NextResponse.json({ error: "origin and destination are required" }, { status: 400 });
  }

  const prediction = await predictFare(body.origin, body.destination);
  return NextResponse.json(prediction);
}
