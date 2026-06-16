import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/journal/:id/public
 * Returns a journal entry WITHOUT authentication — but ONLY if isPublic is true.
 * This powers the shareable link feature.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      trip: { select: { id: true, city: true, country: true } },
      user: { select: { username: true, imageUrl: true } },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!entry.isPublic) {
    return NextResponse.json({ error: "This entry is private" }, { status: 403 });
  }

  // Parse JSON arrays
  const safeJson = (val: string | null) => {
    if (!val) return [];
    try { const a = JSON.parse(val); return Array.isArray(a) ? a : []; }
    catch { return []; }
  };

  return NextResponse.json({
    entry: {
      id: entry.id,
      title: entry.title,
      content: entry.content,
      location: entry.location,
      country: entry.country,
      date: entry.date?.toISOString() ?? null,
      mood: entry.mood,
      weather: entry.weather,
      tags: safeJson(entry.tags),
      photos: safeJson(entry.photos),
      trip: entry.trip ? { city: entry.trip.city, country: entry.trip.country } : null,
      author: {
        username: entry.user.username,
        imageUrl: entry.user.imageUrl,
      },
      createdAt: entry.createdAt.toISOString(),
    },
  });
}
