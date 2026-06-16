import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listWatches, createWatch } from "@/lib/services/watches";


/** GET /api/watches — list all watches for the current user */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watches = await listWatches(user.id);
  return NextResponse.json({ watches });
}

/**
 * POST /api/watches — create a new price watch
 * Body: { origin: string, destinationCode: string, targetPrice: number, currency?: string }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.origin !== "string" ||
    typeof body.destinationCode !== "string" ||
    typeof body.targetPrice !== "number" ||
    body.targetPrice <= 0
  ) {
    return NextResponse.json(
      { error: "Body must include origin (string), destinationCode (string), and targetPrice (positive number)" },
      { status: 400 },
    );
  }

  const watch = await createWatch(user.id, {
    origin: body.origin,
    destinationCode: body.destinationCode,
    targetPrice: body.targetPrice,
    currency: body.currency,
  });

  return NextResponse.json({ watch }, { status: 201 });
}
