import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

/**
 * PUT /api/loyalty/:id
 *
 * Auth: required (must own the balance).
 * Updates a loyalty program balance.
 *
 * Body: { programName?, programCode?, balance?, tier?, expiresAt? }
 * Response: { balance: LoyaltyBalance }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.loyaltyBalance.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON", status: 400 }, { status: 400 });

    const updated = await prisma.loyaltyBalance.update({
      where: { id },
      data: {
        ...(body.programName != null && { programName: body.programName }),
        ...(body.programCode !== undefined && { programCode: body.programCode ?? null }),
        ...(body.balance != null && { balance: body.balance }),
        ...(body.tier !== undefined && { tier: body.tier ?? null }),
        ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
      },
    });

    return NextResponse.json({
      balance: {
        id: updated.id,
        programName: updated.programName,
        programCode: updated.programCode,
        balance: updated.balance,
        tier: updated.tier,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/loyalty/:id
 *
 * Auth: required (must own the balance).
 * Deletes a loyalty program balance.
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
    const existing = await prisma.loyaltyBalance.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });

    await prisma.loyaltyBalance.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
