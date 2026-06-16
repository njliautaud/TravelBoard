import { NextResponse } from "next/server";
import { getBadgeCatalog } from "@/lib/services/gamification";


export async function GET() {
  const badges = getBadgeCatalog();
  return NextResponse.json({ badges });
}
