import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/saved-deals
 *
 * Auth: optional (returns empty array for unauthenticated).
 * Lists the user's saved/favorited deals (starred locations).
 *
 * Response: { deals: Array<{ id, activityName, countryCode, countryName, city, latitude, longitude, createdAt }> }
 */
export async function GET() {
  try {
    const session = await getAuthUser();
    if (!session) {
      return NextResponse.json({ deals: [] });
    }

    const saved = await prisma.location.findMany({
      where: { userId: session.id, starred: true },
      select: {
        id: true,
        activityName: true,
        countryCode: true,
        countryName: true,
        city: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ deals: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/saved-deals
 *
 * Auth: required.
 * Add or remove a saved deal.
 *
 * Body: { flyTo: string, origin?: string, action?: "remove" }
 * Response: { ok: true, action: "added" | "removed" }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body", status: 400 }, { status: 400 });
    }

    const { flyTo, origin, action } = body as { flyTo?: string; origin?: string; action?: string };

    if (!flyTo || typeof flyTo !== "string") {
      return NextResponse.json({ error: "flyTo required", status: 400 }, { status: 400 });
    }

    if (action === "remove") {
      await prisma.location.updateMany({
        where: {
          userId: session.id,
          countryCode: flyTo,
          starred: true,
        },
        data: { starred: false },
      });
      return NextResponse.json({ ok: true, action: "removed" });
    }

    const existing = await prisma.location.findFirst({
      where: { userId: session.id, countryCode: flyTo },
    });

    if (existing) {
      await prisma.location.update({
        where: { id: existing.id },
        data: { starred: true },
      });
    } else {
      await prisma.location.create({
        data: {
          userId: session.id,
          activityName: `Saved deal: ${flyTo}`,
          countryCode: flyTo,
          countryName: origin ?? "",
          latitude: 0,
          longitude: 0,
          starred: true,
        },
      });
    }

    return NextResponse.json({ ok: true, action: "added" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/saved-deals?flyTo=XXX
 *
 * Auth: required.
 * Remove a saved deal by destination code.
 *
 * Query: flyTo (required)
 * Response: { ok: true }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    }

    const flyTo = request.nextUrl.searchParams.get("flyTo");
    if (!flyTo) {
      return NextResponse.json({ error: "flyTo query param required", status: 400 }, { status: 400 });
    }

    await prisma.location.updateMany({
      where: {
        userId: session.id,
        countryCode: flyTo,
        starred: true,
      },
      data: { starred: false },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
