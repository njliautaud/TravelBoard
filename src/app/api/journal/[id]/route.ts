import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { getEntry, updateEntry, deleteEntry } from "@/lib/services/journal";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/journal/:id
 *
 * Auth: required.
 * Returns a single journal entry.
 *
 * Response: { entry: JournalEntry }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;

    const entry = await getEntry(id, user.id);
    if (!entry) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * PUT /api/journal/:id
 *
 * Auth: required.
 * Updates a journal entry.
 *
 * Body: { title?: string, body?: string, ... }
 * Response: { entry: JournalEntry }
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON", status: 400 }, { status: 400 });

    const entry = await updateEntry(id, user.id, body);
    if (!entry) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/journal/:id
 *
 * Auth: required.
 * Deletes a journal entry.
 *
 * Response: { ok: true }
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;

    const deleted = await deleteEntry(id, user.id);
    if (!deleted) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
