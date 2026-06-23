import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { getProgress } from "@/lib/services/gamification";


/**
 * GET /api/gamification/progress
 *
 * Auth: required.
 * Returns gamification progress for the current user.
 *
 * Response: { progress: GamificationProgress }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const progress = await getProgress(user.id);
    return NextResponse.json({ progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
