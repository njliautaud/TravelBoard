import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { updateWatch, deleteWatch } from "@/lib/services/watches";


/** PUT /api/watches/[id] — update a watch (targetPrice, active) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: { targetPrice?: number; active?: boolean } = {};
  if (typeof body.targetPrice === "number" && body.targetPrice > 0) {
    data.targetPrice = body.targetPrice;
  }
  if (typeof body.active === "boolean") {
    data.active = body.active;
  }

  const watch = await updateWatch(id, user.id, data);
  if (!watch) {
    return NextResponse.json({ error: "Watch not found" }, { status: 404 });
  }

  return NextResponse.json({ watch });
}

/** DELETE /api/watches/[id] — remove a watch */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteWatch(id, user.id);
  if (!ok) {
    return NextResponse.json({ error: "Watch not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
