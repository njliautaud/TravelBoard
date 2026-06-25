import type { Prisma } from "@prisma/client";
import type { LocationItem, DraftItem } from "./types";
import type { Draft } from "@prisma/client";

export type LocationWithRelations = Prisma.LocationGetPayload<{
  include: { media: true; flightPrices: true };
}>;

export function serializeLocation(loc: LocationWithRelations): LocationItem {
  const latest = loc.flightPrices[0] ?? null;
  const threshold = loc.priceThreshold === null ? null : Number(loc.priceThreshold);
  const latestPrice = latest
    ? {
        price: Number(latest.price),
        currency: latest.currency,
        origin: latest.origin,
        destination: latest.destination,
        fetchedAt: latest.fetchedAt.toISOString(),
      }
    : null;
  return {
    id: loc.id,
    activityName: loc.activityName,
    countryCode: loc.countryCode,
    countryName: loc.countryName,
    region: loc.region,
    city: loc.city,
    latitude: loc.latitude,
    longitude: loc.longitude,
    status: loc.status,
    notes: loc.notes,
    reminderAt: loc.reminderAt?.toISOString() ?? null,
    priceThreshold: threshold,
    starred: loc.starred,
    sortOrder: loc.sortOrder ?? 0,
    coverImageUrl: loc.coverImageUrl,
    seasonSpring: loc.seasonSpring,
    seasonSummer: loc.seasonSummer,
    seasonFall: loc.seasonFall,
    seasonWinter: loc.seasonWinter,
    media: loc.media
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({ id: m.id, type: m.type, url: m.url, caption: m.caption, sortOrder: m.sortOrder })),
    latestPrice,
    isDeal: latestPrice !== null && threshold !== null && latestPrice.price <= threshold,
    createdAt: loc.createdAt.toISOString(),
    updatedAt: loc.updatedAt.toISOString(),
  };
}

export function serializeDraft(d: Draft): DraftItem {
  return {
    id: d.id,
    rawText: d.rawText,
    extractedUrl: d.extractedUrl,
    source: d.source,
    createdAt: d.createdAt.toISOString(),
  };
}

export const locationInclude = {
  media: true,
  flightPrices: { orderBy: { fetchedAt: "desc" as const }, take: 1 },
};
