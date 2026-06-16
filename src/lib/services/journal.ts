/**
 * Journal service — CRUD for travel journal entries.
 *
 * Adapted from Meridian's travel-journal.ts to use Prisma/PostgreSQL.
 * Entries can link to Trips, include mood/weather/tags/photos, and
 * provide aggregate stats (countries visited, travel timeline).
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JournalEntryData {
  id: string;
  userId: string;
  tripId: string | null;
  title: string;
  content: string;
  location: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  date: string | null;
  mood: string | null;
  weather: string | null;
  tags: string[];
  photos: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  trip?: { id: string; city: string; country: string } | null;
}

export interface JournalCreateInput {
  title: string;
  content: string;
  tripId?: string;
  location?: string;
  country?: string;
  lat?: number;
  lon?: number;
  date?: string;
  mood?: string;
  weather?: string;
  tags?: string[];
  photos?: string[];
  isPublic?: boolean;
}

export interface JournalUpdateInput {
  title?: string;
  content?: string;
  tripId?: string | null;
  location?: string;
  country?: string;
  lat?: number;
  lon?: number;
  date?: string;
  mood?: string;
  weather?: string;
  tags?: string[];
  photos?: string[];
  isPublic?: boolean;
}

export interface JournalStats {
  totalEntries: number;
  countriesVisited: string[];
  totalCountries: number;
  topTags: Array<{ tag: string; count: number }>;
  moodBreakdown: Record<string, number>;
  timeline: Array<{ month: string; count: number }>;
  recentEntries: JournalEntryData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const a = JSON.parse(val);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function serializeEntry(row: {
  id: string;
  userId: string;
  tripId: string | null;
  title: string;
  content: string;
  location: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  date: Date | null;
  mood: string | null;
  weather: string | null;
  tags: string | null;
  photos: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  trip?: { id: string; city: string; country: string } | null;
}): JournalEntryData {
  return {
    id: row.id,
    userId: row.userId,
    tripId: row.tripId,
    title: row.title,
    content: row.content,
    location: row.location,
    country: row.country,
    lat: row.lat,
    lon: row.lon,
    date: row.date?.toISOString() ?? null,
    mood: row.mood,
    weather: row.weather,
    tags: safeJsonArray(row.tags),
    photos: safeJsonArray(row.photos),
    isPublic: row.isPublic,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    trip: row.trip ? { id: row.trip.id, city: row.trip.city, country: row.trip.country } : null,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listEntries(
  userId: string,
  opts?: { tripId?: string; country?: string; tag?: string; from?: string; to?: string },
): Promise<JournalEntryData[]> {
  const where: Record<string, unknown> = { userId };
  if (opts?.tripId) where.tripId = opts.tripId;
  if (opts?.country) where.country = opts.country;
  if (opts?.from || opts?.to) {
    where.date = {
      ...(opts?.from ? { gte: new Date(opts.from) } : {}),
      ...(opts?.to ? { lte: new Date(opts.to) } : {}),
    };
  }

  const rows = await prisma.journalEntry.findMany({
    where,
    include: { trip: { select: { id: true, city: true, country: true } } },
    orderBy: { date: "desc" },
  });

  let entries = rows.map(serializeEntry);

  // Tag filter in-memory (tags stored as JSON string)
  if (opts?.tag) {
    const t = opts.tag.toLowerCase();
    entries = entries.filter((e) => e.tags.some((tag) => tag.toLowerCase() === t));
  }

  return entries;
}

export async function getEntry(id: string, userId: string): Promise<JournalEntryData | null> {
  const row = await prisma.journalEntry.findFirst({
    where: { id, userId },
    include: { trip: { select: { id: true, city: true, country: true } } },
  });
  return row ? serializeEntry(row) : null;
}

export async function createEntry(userId: string, input: JournalCreateInput): Promise<JournalEntryData> {
  const row = await prisma.journalEntry.create({
    data: {
      userId,
      tripId: input.tripId ?? null,
      title: input.title.trim(),
      content: input.content,
      location: input.location?.trim() ?? null,
      country: input.country?.trim() ?? null,
      lat: input.lat ?? null,
      lon: input.lon ?? null,
      date: input.date ? new Date(input.date) : new Date(),
      mood: input.mood ?? null,
      weather: input.weather ?? null,
      tags: JSON.stringify(input.tags ?? []),
      photos: JSON.stringify(input.photos ?? []),
      isPublic: input.isPublic ?? false,
    },
    include: { trip: { select: { id: true, city: true, country: true } } },
  });
  return serializeEntry(row);
}

export async function updateEntry(
  id: string,
  userId: string,
  input: JournalUpdateInput,
): Promise<JournalEntryData | null> {
  const existing = await prisma.journalEntry.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.content !== undefined) data.content = input.content;
  if (input.tripId !== undefined) data.tripId = input.tripId;
  if (input.location !== undefined) data.location = input.location?.trim() ?? null;
  if (input.country !== undefined) data.country = input.country?.trim() ?? null;
  if (input.lat !== undefined) data.lat = input.lat;
  if (input.lon !== undefined) data.lon = input.lon;
  if (input.date !== undefined) data.date = input.date ? new Date(input.date) : null;
  if (input.mood !== undefined) data.mood = input.mood;
  if (input.weather !== undefined) data.weather = input.weather;
  if (input.tags !== undefined) data.tags = JSON.stringify(input.tags);
  if (input.photos !== undefined) data.photos = JSON.stringify(input.photos);
  if (input.isPublic !== undefined) data.isPublic = input.isPublic;

  const row = await prisma.journalEntry.update({
    where: { id },
    data,
    include: { trip: { select: { id: true, city: true, country: true } } },
  });
  return serializeEntry(row);
}

export async function deleteEntry(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.journalEntry.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.journalEntry.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getJournalStats(userId: string): Promise<JournalStats> {
  const entries = await listEntries(userId);

  // Countries
  const countries = [...new Set(entries.map((e) => e.country).filter(Boolean))] as string[];

  // Tags
  const tagMap = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.tags) {
      tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
    }
  }
  const topTags = [...tagMap.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Mood breakdown
  const moodBreakdown: Record<string, number> = {};
  for (const e of entries) {
    if (e.mood) {
      moodBreakdown[e.mood] = (moodBreakdown[e.mood] ?? 0) + 1;
    }
  }

  // Timeline (entries per month)
  const monthMap = new Map<string, number>();
  for (const e of entries) {
    if (e.date) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    }
  }
  const timeline = [...monthMap.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    totalEntries: entries.length,
    countriesVisited: countries,
    totalCountries: countries.length,
    topTags,
    moodBreakdown,
    timeline,
    recentEntries: entries.slice(0, 5),
  };
}
