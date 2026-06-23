import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { listWatches, createWatch } from "@/lib/services/watches";

/**
 * GET /api/watches
 *
 * Auth: required.
 * Lists all price watches for the current user.
 *
 * Response: { watches: Watch[] }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const watches = await listWatches(user.id);
    return NextResponse.json({ watches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/watches
 *
 * Auth: required.
 * Creates a new price watch for a route.
 *
 * Body: { origin: string, destinationCode: string, targetPrice: number, currency?: string }
 * Response: { watch: Watch }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body.origin !== "string" ||
      typeof body.destinationCode !== "string" ||
      typeof body.targetPrice !== "number" ||
      body.targetPrice <= 0
    ) {
      return NextResponse.json(
        { error: "Body must include origin (string), destinationCode (string), and targetPrice (positive number)", status: 400 },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
