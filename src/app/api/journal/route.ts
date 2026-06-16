import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listEntries, createEntry } from "@/lib/services/journal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const entries = await listEntries(user.id, {
    tripId: url.searchParams.get("tripId") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const entry = await createEntry(user.id, body);
  return NextResponse.json({ entry }, { status: 201 });
}
