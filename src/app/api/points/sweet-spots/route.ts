import { NextRequest, NextResponse } from "next/server";
import { getSweetSpots } from "@/lib/services/points";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") ?? undefined;
  const cabin = searchParams.get("cabin") ?? undefined;

  const spots = getSweetSpots(region, cabin);
  return NextResponse.json({ sweetSpots: spots });
}
