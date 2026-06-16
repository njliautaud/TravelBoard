/**
 * Trips (Memory mode) service — CRUD for visited trips + travel stats.
 *
 * Uses the existing Trip Prisma model and geo math from @travelboard/core
 * for distance calculations and great-circle arc generation.
 */

import { prisma } from "@/lib/prisma";
import { haversineMiles, greatCirclePoints } from "@travelboard/core";
import type { GeoPoint } from "@travelboard/core";
import { continentForCountry } from "@/lib/geo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TripData {
  id: string;
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
  rating: number | null;
  coverImageUrl: string | null;
  createdAt: string;
}

export interface TripCreateInput {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  startDate?: string;
  endDate?: string;
  note?: string;
  rating?: number;
  coverImageUrl?: string;
}

export interface TripUpdateInput {
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
  startDate?: string | null;
  endDate?: string | null;
  note?: string | null;
  rating?: number | null;
  coverImageUrl?: string | null;
}

export interface TravelStatsData {
  countries: number;
  continents: number;
  miles: number;
  trips: number;
  /** Country codes visited */
  countryCodes: string[];
  /** Continent names visited */
  continentNames: string[];
}

export interface ArcData {
  from: GeoPoint;
  to: GeoPoint;
  points: GeoPoint[];
  distanceMiles: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeTrip(trip: {
  id: string;
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  startDate: Date | null;
  endDate: Date | null;
  note: string | null;
  rating: number | null;
  coverImageUrl: string | null;
  createdAt: Date;
}): TripData {
  return {
    id: trip.id,
    code: trip.code,
    city: trip.city,
    country: trip.country,
    lat: trip.lat,
    lon: trip.lon,
    startDate: trip.startDate?.toISOString() ?? null,
    endDate: trip.endDate?.toISOString() ?? null,
    note: trip.note,
    rating: trip.rating,
    coverImageUrl: trip.coverImageUrl,
    createdAt: trip.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** List all trips for a user, ordered by startDate descending. */
export async function listTrips(userId: string): Promise<TripData[]> {
  const trips = await prisma.trip.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
  });
  return trips.map(serializeTrip);
}

/** Get a single trip by id (must belong to user). */
export async function getTrip(
  userId: string,
  tripId: string,
): Promise<TripData | null> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
  return trip ? serializeTrip(trip) : null;
}

/** Create a new trip for a user. */
export async function createTrip(
  userId: string,
  input: TripCreateInput,
): Promise<TripData> {
  const trip = await prisma.trip.create({
    data: {
      userId,
      code: input.code,
      city: input.city,
      country: input.country,
      lat: input.lat,
      lon: input.lon,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      note: input.note ?? null,
      rating: input.rating ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
    },
  });
  return serializeTrip(trip);
}

/** Update an existing trip. */
export async function updateTrip(
  userId: string,
  tripId: string,
  input: TripUpdateInput,
): Promise<TripData | null> {
  // Verify ownership
  const existing = await prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (input.city !== undefined) data.city = input.city;
  if (input.country !== undefined) data.country = input.country;
  if (input.lat !== undefined) data.lat = input.lat;
  if (input.lon !== undefined) data.lon = input.lon;
  if (input.note !== undefined) data.note = input.note;
  if (input.rating !== undefined) data.rating = input.rating;
  if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl;
  if (input.startDate !== undefined) {
    data.startDate = input.startDate ? new Date(input.startDate) : null;
  }
  if (input.endDate !== undefined) {
    data.endDate = input.endDate ? new Date(input.endDate) : null;
  }

  const trip = await prisma.trip.update({
    where: { id: tripId },
    data,
  });
  return serializeTrip(trip);
}

/** Delete a trip. Returns true if deleted, false if not found. */
export async function deleteTrip(
  userId: string,
  tripId: string,
): Promise<boolean> {
  const existing = await prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
  if (!existing) return false;

  await prisma.trip.delete({ where: { id: tripId } });
  return true;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Compute travel stats for a user: total countries, continents, cumulative
 * miles (great-circle between consecutive trips in date order).
 */
export async function getTravelStats(userId: string): Promise<TravelStatsData> {
  const trips = await prisma.trip.findMany({
    where: { userId },
    orderBy: { startDate: "asc" },
    select: { code: true, country: true, lat: true, lon: true },
  });

  const countryCodes = [...new Set(trips.map((t) => t.code.slice(0, 2).toUpperCase()))];
  // Use the country field directly for continent lookup — it is typically a
  // 2-letter or full name. We also try the first 2 chars of `code` as a heuristic.
  const countrySet = new Set<string>();
  const continentSet = new Set<string>();

  for (const t of trips) {
    // Use the country field. If it looks like a 2-letter code, use directly;
    // otherwise just add it as-is for the country count.
    const cc = t.country.length === 2 ? t.country.toUpperCase() : t.country;
    countrySet.add(cc);
    const cont = continentForCountry(
      t.country.length === 2 ? t.country : t.code.slice(0, 2),
    );
    if (cont !== "Unknown") continentSet.add(cont);
  }

  // Cumulative miles between consecutive trip locations
  let totalMiles = 0;
  for (let i = 1; i < trips.length; i++) {
    const a: GeoPoint = { lat: trips[i - 1]!.lat, lon: trips[i - 1]!.lon };
    const b: GeoPoint = { lat: trips[i]!.lat, lon: trips[i]!.lon };
    totalMiles += haversineMiles(a, b);
  }

  return {
    countries: countrySet.size,
    continents: continentSet.size,
    miles: Math.round(totalMiles),
    trips: trips.length,
    countryCodes: [...countrySet],
    continentNames: [...continentSet],
  };
}

// ---------------------------------------------------------------------------
// Arcs
// ---------------------------------------------------------------------------

/**
 * Generate great-circle arc data between consecutive trips (ordered by date).
 * Each arc includes sampled points for drawing curved lines on a map.
 */
export async function getTripArcs(userId: string): Promise<ArcData[]> {
  const trips = await prisma.trip.findMany({
    where: { userId },
    orderBy: { startDate: "asc" },
    select: { lat: true, lon: true },
  });

  const arcs: ArcData[] = [];
  for (let i = 1; i < trips.length; i++) {
    const from: GeoPoint = { lat: trips[i - 1]!.lat, lon: trips[i - 1]!.lon };
    const to: GeoPoint = { lat: trips[i]!.lat, lon: trips[i]!.lon };
    const dist = haversineMiles(from, to);
    // Only generate arcs for trips that are far enough apart to be interesting
    if (dist > 50) {
      arcs.push({
        from,
        to,
        points: greatCirclePoints(from, to, 64),
        distanceMiles: Math.round(dist),
      });
    }
  }
  return arcs;
}
