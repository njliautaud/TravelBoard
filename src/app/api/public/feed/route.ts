import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializePublicSpot } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/feed — the public feed of individually-published spots.
 * No auth: anyone (including logged-out visitors) may read it. Returns only the
 * safe public subset (see serializePublicSpot); private board data is never
 * exposed here. Read-only — there is no mutation route under /api/public.
 */
export async function GET() {
  const spots = await prisma.location.findMany({
    where: { isPublic: true },
    include: { media: true, user: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ spots: spots.map(serializePublicSpot) });
}
