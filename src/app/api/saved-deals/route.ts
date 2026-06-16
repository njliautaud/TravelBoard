import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/saved-deals — list user's saved/favorited deals
 * POST /api/saved-deals — add or remove a saved deal
 * DELETE /api/saved-deals?flyTo=XXX&origin=YYY — remove a saved deal
 */

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ deals: [] });
  }

  // Use Location model as saved-deal proxy (starred locations)
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
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { flyTo, origin, action } = body as { flyTo?: string; origin?: string; action?: string };

  if (!flyTo) {
    return NextResponse.json({ error: "flyTo required" }, { status: 400 });
  }

  if (action === "remove") {
    // Unstar matching locations
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

  // Check if location already exists
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
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flyTo = request.nextUrl.searchParams.get("flyTo");
  if (!flyTo) {
    return NextResponse.json({ error: "flyTo required" }, { status: 400 });
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
}
