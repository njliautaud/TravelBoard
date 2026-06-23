import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/loyalty
 *
 * Auth: required.
 * Lists all loyalty program balances for the current user.
 *
 * Response: { balances: LoyaltyBalance[] }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/loyalty
 *
 * Auth: required.
 * Adds a new loyalty program balance.
 *
 * Body: { programName: string, programCode?: string, balance?: number, tier?: string, expiresAt?: string }
 * Response: { balance: LoyaltyBalance }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.programName) {
      return NextResponse.json({ error: "programName is required", status: 400 }, { status: 400 });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
