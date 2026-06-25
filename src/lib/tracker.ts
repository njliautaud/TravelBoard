/**
 * Lightweight analytics tracker for TravelBoard.
 *
 * Usage:
 *   import { track } from "@/lib/tracker";
 *   track("deal_click", { origin: "MCO", destination: "LHR", price: 299 });
 *
 * Events are fire-and-forget — they never block UI or throw errors.
 * All events are persisted server-side in the AnalyticsEvent table.
 */

type EventProps = Record<string, string | number | boolean | null | undefined>;

/** Debounce duplicate events (same type + same JSON props within 2s) */
const recentEvents = new Map<string, number>();
const DEBOUNCE_MS = 2000;

/**
 * Track a user event. Fire-and-forget, never throws.
 */
export function track(event: string, props?: EventProps): void {
  if (typeof window === "undefined") return;

  // Debounce exact duplicates
  const key = `${event}:${JSON.stringify(props ?? {})}`;
  const now = Date.now();
  const last = recentEvents.get(key);
  if (last && now - last < DEBOUNCE_MS) return;
  recentEvents.set(key, now);

  // Cleanup old debounce entries periodically
  if (recentEvents.size > 100) {
    for (const [k, v] of recentEvents) {
      if (now - v > DEBOUNCE_MS * 5) recentEvents.delete(k);
    }
  }

  // Enrich with basic context
  const enrichedProps: EventProps = {
    ...props,
    url: window.location.pathname,
    referrer: document.referrer || undefined,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    ts: new Date().toISOString(),
  };

  // Fire-and-forget POST
  try {
    const apiBase =
      typeof window !== "undefined" &&
      (window as unknown as Record<string, unknown>).__NEXT_DATA__
        ? ""
        : "";
    fetch(`${apiBase}/api/analytics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, props: enrichedProps }),
      keepalive: true, // survives page navigation
    }).catch(() => {}); // swallow network errors
  } catch {
    // Never throw from analytics
  }
}

// ── Convenience wrappers for common events ─────────────────────────

export function trackPageView(page?: string): void {
  track("page_view", { page: page ?? window.location.pathname });
}

export function trackDealClick(deal: {
  origin?: string;
  destination?: string;
  price?: number;
  source?: string;
  dealType?: string;
}): void {
  track("deal_click", deal);
}

export function trackDealSave(deal: {
  origin?: string;
  destination?: string;
  price?: number;
}): void {
  track("deal_save", deal);
}

export function trackSearch(query: {
  origin?: string;
  destination?: string;
  dates?: string;
  cabin?: string;
  filters?: string;
}): void {
  track("search", query);
}

export function trackAlertCreate(alert: {
  origin?: string;
  destination?: string;
  targetPrice?: number;
}): void {
  track("alert_create", alert);
}

export function trackFeatureUse(feature: string, details?: EventProps): void {
  track("feature_use", { feature, ...details });
}

export function trackOnboardingComplete(data: {
  airportCount?: number;
  flightPref?: string;
  programCount?: number;
}): void {
  track("onboarding_complete", data);
}

export function trackSignIn(method?: string): void {
  track("sign_in", { method });
}

export function trackSignUp(method?: string): void {
  track("sign_up", { method });
}

export function trackMapInteraction(action: string, details?: EventProps): void {
  track("map_interaction", { action, ...details });
}

export function trackDestinationView(destination: {
  code?: string;
  city?: string;
  country?: string;
}): void {
  track("destination_view", destination);
}
