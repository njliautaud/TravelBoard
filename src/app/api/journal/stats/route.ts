import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { getJournalStats } from "@/lib/services/journal";


/**
 * GET /api/journal/stats
 *
 * Auth: required.
 * Returns journal statistics for the current user.
 *
 * Response: { stats: JournalStats }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const stats = await getJournalStats(user.id);
    return NextResponse.json({ stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
