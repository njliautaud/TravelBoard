import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getJournalStats } from "@/lib/services/journal";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stats = await getJournalStats(user.id);
  return NextResponse.json({ stats });
}
