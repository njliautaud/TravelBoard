import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getProgress } from "@/lib/services/gamification";


export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const progress = await getProgress(user.id);
  return NextResponse.json({ progress });
}
