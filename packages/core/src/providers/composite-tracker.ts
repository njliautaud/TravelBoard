/**
 * CompositeFlightTracker — cascading tracker that tries multiple providers in order:
 *   1. AirLabs (best data quality, flight-number friendly)
 *   2. OpenSky (free, no key, callsign-based)
 *   3. MockFlightTracker (deterministic fallback, always works)
 *
 * AirLabs responses are cached for 60 seconds to conserve the 1000 req/month budget.
 *
 * Implements the sacred FlightTrackerProvider interface.
 */

import type { FlightTrackerProvider, FlightTelemetry } from './types.js';

interface CacheEntry {
  data: FlightTelemetry;
  expiresAt: number;
}

export interface CompositeTrackerOptions {
  /** Ordered list of providers to try. Falls back to next on error/no data. */
  providers: FlightTrackerProvider[];
  /** Cache TTL in ms for non-mock responses (default: 60_000 = 60s). */
  cacheTtlMs?: number;
}

export class CompositeFlightTracker implements FlightTrackerProvider {
  private readonly providers: FlightTrackerProvider[];
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(opts: CompositeTrackerOptions) {
    if (opts.providers.length === 0) {
      throw new Error('CompositeFlightTracker requires at least one provider.');
    }
    this.providers = opts.providers;
    this.cacheTtlMs = opts.cacheTtlMs ?? 60_000;
  }

  async track(flight: string): Promise<FlightTelemetry> {
    const key = flight.trim().toUpperCase();

    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    let lastError: Error | undefined;

    for (const provider of this.providers) {
      try {
        const result = await provider.track(flight);

        // Cache the result (don't cache mock results — they're free and instant)
        if (this.cacheTtlMs > 0) {
          this.cache.set(key, {
            data: result,
            expiresAt: Date.now() + this.cacheTtlMs,
          });
        }

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Continue to next provider
      }
    }

    throw lastError ?? new Error(`CompositeTracker: all providers failed for "${flight}"`);
  }
}
