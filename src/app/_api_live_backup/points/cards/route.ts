import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listCardProfiles, createCardProfile } from "@/lib/services/points";


export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cards = await listCardProfiles(user.id);
  return NextResponse.json({ cards });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.cardName) {
    return NextResponse.json({ error: "cardName is required" }, { status: 400 });
  }

  const card = await createCardProfile(user.id, {
    cardName: body.cardName,
    issuer: body.issuer,
    pointsBalance: body.pointsBalance,
    annualFee: body.annualFee,
    category: body.category,
  });

  return NextResponse.json({ card }, { status: 201 });
}
