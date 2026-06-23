import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/journal/countries
 * Returns countries that have journal entries, with entry counts and representative coordinates.
 * Used by the map to highlight countries where the user has memories.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ countries: [] });

  try {
    const entries = await prisma.journalEntry.findMany({
      where: { userId: user.id },
      select: {
        country: true,
        lat: true,
        lon: true,
        title: true,
        date: true,
        mood: true,
      },
    });

    // Group by country name and collect data
    const countryMap = new Map<
      string,
      {
        country: string;
        entryCount: number;
        lat: number | null;
        lon: number | null;
        latestDate: string | null;
        moods: string[];
      }
    >();

    for (const e of entries) {
      if (!e.country) continue;
      const existing = countryMap.get(e.country);
      if (existing) {
        existing.entryCount++;
        // Use the latest entry's coords if better
        if (e.lat && e.lon && !existing.lat) {
          existing.lat = e.lat;
          existing.lon = e.lon;
        }
        if (e.date) {
          const dateStr = e.date.toISOString();
          if (!existing.latestDate || dateStr > existing.latestDate) {
            existing.latestDate = dateStr;
          }
        }
        if (e.mood && !existing.moods.includes(e.mood)) {
          existing.moods.push(e.mood);
        }
      } else {
        countryMap.set(e.country, {
          country: e.country,
          entryCount: 1,
          lat: e.lat,
          lon: e.lon,
          latestDate: e.date?.toISOString() ?? null,
          moods: e.mood ? [e.mood] : [],
        });
      }
    }

    const countries = [...countryMap.values()];
    return NextResponse.json({ countries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
