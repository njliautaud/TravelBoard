import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/journal/public
 * Returns all public journal entries (isPublic=true), newest first.
 * No authentication required.
 */
export async function GET() {
  try {
    const entries = await prisma.journalEntry.findMany({
      where: { isPublic: true },
      orderBy: { date: "desc" },
      include: {
        trip: { select: { id: true, city: true, country: true } },
        user: { select: { username: true, imageUrl: true } },
      },
    });

    const safeJson = (val: string | null) => {
      if (!val) return [];
      try {
        const a = JSON.parse(val);
        return Array.isArray(a) ? a : [];
      } catch {
        return [];
      }
    };

    const result = entries.map((entry) => ({
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
      trip: entry.trip
        ? { city: entry.trip.city, country: entry.trip.country }
        : null,
      author: {
        username: entry.user.username,
        imageUrl: entry.user.imageUrl,
      },
      createdAt: entry.createdAt.toISOString(),
    }));

    return NextResponse.json({ entries: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
