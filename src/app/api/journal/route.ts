import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { listEntries, createEntry } from "@/lib/services/journal";

/**
 * GET /api/journal
 *
 * Auth: required.
 * Lists journal entries for the current user, with optional filters.
 *
 * Query params: tripId, country, tag, from, to
 * Response: { entries: JournalEntry[] }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const url = new URL(req.url);
    const entries = await listEntries(user.id, {
      tripId: url.searchParams.get("tripId") ?? undefined,
      country: url.searchParams.get("country") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/journal
 *
 * Auth: required.
 * Creates a new journal entry.
 *
 * Body: { title: string, body?: string, country?: string, ... }
 * Response: { entry: JournalEntry }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || !body.title?.trim()) {
      return NextResponse.json({ error: "Title is required", status: 400 }, { status: 400 });
    }

    const entry = await createEntry(user.id, body);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
