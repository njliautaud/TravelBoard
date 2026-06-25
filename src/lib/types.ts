export type MediaType = "UPLOAD" | "IMAGE_URL" | "LINK";
export type VisitStatus = "TO_VISIT" | "VISITED";

/** Map/list view filter: everything, only to-visit ("wished"), or only visited. */
export type StatusFilter = "all" | "wished" | "visited";

/** Primary navigation section (left edge-dock on desktop, bottom nav on mobile). */
export type Panel = "journal" | "passport" | "friends" | "flights" | "settings";

/** True when a wish passes the given status filter. */
export function matchesStatusFilter(status: VisitStatus, filter: StatusFilter): boolean {
  if (filter === "wished") return status === "TO_VISIT";
  if (filter === "visited") return status === "VISITED";
  return true;
}

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
  isPublic: boolean;
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

/** A selectable account in the sidebar profile switcher. */
export interface UserProfile {
  id: string;
  username: string;
}

/** A user as shown in the friends list / inbox. */
export interface FriendUser {
  id: string;
  username: string;
}

/** An accepted friend. */
export interface FriendItem {
  friendshipId: string;
  user: FriendUser;
  /** When the friendship was accepted (or created, if older rows). */
  since: string;
}

/** A pending friend request (incoming = to me, outgoing = from me). */
export interface PendingRequest {
  friendshipId: string;
  user: FriendUser;
  createdAt: string;
}

export interface FriendsData {
  friends: FriendItem[];
  incoming: PendingRequest[];
  outgoing: PendingRequest[];
}

/** Aggregated board stats shown in a friend's profile preview card. */
export interface ProfileStats {
  total: number;
  visited: number;
  toVisit: number;
  countries: number;
}

export type NotificationType = "FRIEND_REQUEST" | "FRIEND_ACCEPTED";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actor: FriendUser | null;
  friendshipId: string | null;
  read: boolean;
  createdAt: string;
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
