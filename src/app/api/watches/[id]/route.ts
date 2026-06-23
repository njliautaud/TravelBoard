import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { updateWatch, deleteWatch } from "@/lib/services/watches";

/**
 * PUT /api/watches/:id
 *
 * Auth: required (must own the watch).
 * Updates a price watch (target price or active status).
 *
 * Body: { targetPrice?: number, active?: boolean }
 * Response: { watch: Watch }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body", status: 400 }, { status: 400 });

    const data: { targetPrice?: number; active?: boolean } = {};
    if (typeof body.targetPrice === "number" && body.targetPrice > 0) {
      data.targetPrice = body.targetPrice;
    }
    if (typeof body.active === "boolean") {
      data.active = body.active;
    }

    const watch = await updateWatch(id, user.id, data);
    if (!watch) return NextResponse.json({ error: "Watch not found", status: 404 }, { status: 404 });

    return NextResponse.json({ watch });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/watches/:id
 *
 * Auth: required (must own the watch).
 * Removes a price watch.
 *
 * Response: { ok: true }
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const ok = await deleteWatch(id, user.id);
    if (!ok) return NextResponse.json({ error: "Watch not found", status: 404 }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
