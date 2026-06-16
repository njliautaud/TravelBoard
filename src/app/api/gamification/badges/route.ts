import { NextResponse } from "next/server";
import { getBadgeCatalog } from "@/lib/services/gamification";

export const dynamic = "force-dynamic";

export async function GET() {
  const badges = getBadgeCatalog();
  return NextResponse.json({ badges });
}
