import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const balances = await prisma.loyaltyBalance.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    balances: balances.map((b) => ({
      id: b.id,
      programName: b.programName,
      programCode: b.programCode,
      balance: b.balance,
      tier: b.tier,
      expiresAt: b.expiresAt?.toISOString() ?? null,
      updatedAt: b.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.programName) {
    return NextResponse.json({ error: "programName is required" }, { status: 400 });
  }

  const balance = await prisma.loyaltyBalance.create({
    data: {
      userId: user.id,
      programName: body.programName,
      programCode: body.programCode ?? null,
      balance: body.balance ?? 0,
      tier: body.tier ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });

  return NextResponse.json({
    balance: {
      id: balance.id,
      programName: balance.programName,
      programCode: balance.programCode,
      balance: balance.balance,
      tier: balance.tier,
      expiresAt: balance.expiresAt?.toISOString() ?? null,
      updatedAt: balance.updatedAt.toISOString(),
    },
  }, { status: 201 });
}
