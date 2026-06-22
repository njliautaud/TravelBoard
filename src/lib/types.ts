export type MediaType = "UPLOAD" | "IMAGE_URL" | "LINK";
export type VisitStatus = "TO_VISIT" | "VISITED";

export interface MediaItem {
  id?: string;
  type: MediaType;
  url: string;
  caption: string | null;
  sortOrder: number;
}

export interface LatestPrice {
  price: number;
  currency: string;
  origin: string | null;
  destination: string | null;
  fetchedAt: string;
}

export interface LocationItem {
  id: string;
  activityName: string;
  countryCode: string;
  countryName: string;
  region: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  status: VisitStatus;
  notes: string | null;
  reminderAt: string | null;
  priceThreshold: number | null;
  starred: boolean;
  sortOrder: number;
  coverImageUrl: string | null;
  seasonSpring: boolean;
  seasonSummer: boolean;
  seasonFall: boolean;
  seasonWinter: boolean;
  media: MediaItem[];
  latestPrice: LatestPrice | null;
  isDeal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DraftItem {
  id: string;
  rawText: string | null;
  extractedUrl: string | null;
  source: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
}

export interface GeocodeResult {
  displayName: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
}

export interface DraftPrefill {
  activityName?: string;
  notes?: string;
  coverImageUrl?: string;
  countryName?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  media?: Omit<MediaItem, "id">[];
  /** URL to fetch smart metadata from when opening a draft */
  enrichUrl?: string;
  enrichRawText?: string | null;
}
