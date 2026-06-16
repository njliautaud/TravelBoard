import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.loyaltyBalance.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

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
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.loyaltyBalance.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.loyaltyBalance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
