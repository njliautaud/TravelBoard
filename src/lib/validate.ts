import type { MediaItem } from "./types";

export interface LocationBody {
  activityName?: string;
  countryCode?: string;
  countryName?: string;
  region?: string | null;
  city?: string | null;
  latitude?: number;
  longitude?: number;
  status?: "TO_VISIT" | "VISITED";
  notes?: string | null;
  reminderAt?: string | null;
  priceThreshold?: number | null;
  coverImageUrl?: string | null;
  seasonSpring?: boolean;
  seasonSummer?: boolean;
  seasonFall?: boolean;
  seasonWinter?: boolean;
  media?: Omit<MediaItem, "id">[];
}

export function validateLocationBody(body: LocationBody): string | null {
  if (!body.activityName?.trim()) return "activityName is required";
  if (!body.countryCode?.trim()) return "countryCode is required";
  if (!body.countryName?.trim()) return "countryName is required";
  if (typeof body.latitude !== "number" || body.latitude < -90 || body.latitude > 90)
    return "latitude must be a number between -90 and 90";
  if (typeof body.longitude !== "number" || body.longitude < -180 || body.longitude > 180)
    return "longitude must be a number between -180 and 180";
  if (body.status && !["TO_VISIT", "VISITED"].includes(body.status)) return "invalid status";
  return null;
}
