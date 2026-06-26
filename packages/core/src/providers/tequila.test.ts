/**
 * Unit tests for the TequilaProvider response→FareQuote mapper.
 * Uses a realistic sample payload based on the verified Tequila /v2/search response schema.
 */

import { describe, it, expect } from 'vitest';
import { mapResultToFareQuote, TequilaProvider, type TequilaSearchResult } from './tequila';

/** Realistic sample Tequila search result, shaped from the verified API contract. */
const SAMPLE_RESULT: TequilaSearchResult = {
  flyFrom: 'MCO',
  flyTo: 'LIS',
  cityFrom: 'Orlando',
  cityTo: 'Lisbon',
  countryFrom: { code: 'US', name: 'United States' },
  countryTo: { code: 'PT', name: 'Portugal' },
  price: 387,
  distance: 6826.4, // km
  deep_link:
    'https://www.kiwi.com/deep?from=MCO&to=LIS&departure=01-07-2026&return=08-07-2026&flightsId=abc123',
  route: [
    {
      flyFrom: 'MCO',
      flyTo: 'LIS',
      cityFrom: 'Orlando',
      cityTo: 'Lisbon',
      airline: 'TP',
      flight_no: 225,
      local_departure: '2026-07-01T22:30:00.000Z',
      local_arrival: '2026-07-02T10:45:00.000Z',
    },
  ],
};

/** A second sample for a city NOT in our curated dataset — tests graceful degradation. */
const SAMPLE_UNKNOWN_CITY: TequilaSearchResult = {
  flyFrom: 'MCO',
  flyTo: 'TBS', // Tbilisi — not in DESTINATIONS
  cityFrom: 'Orlando',
  cityTo: 'Tbilisi',
  countryFrom: { code: 'US', name: 'United States' },
  countryTo: { code: 'GE', name: 'Georgia' },
  price: 612,
  distance: 10200, // km
  deep_link: 'https://www.kiwi.com/deep?from=MCO&to=TBS&departure=15-07-2026',
  route: [],
};

const FETCHED_AT = '2026-07-01T12:00:00.000Z';

describe('mapResultToFareQuote', () => {
  it('maps a known destination with correct fields', () => {
    const quote = mapResultToFareQuote(SAMPLE_RESULT, FETCHED_AT);

    expect(quote.flyFrom).toBe('MCO');
    expect(quote.flyTo).toBe('LIS');
    expect(quote.cityTo).toBe('Lisbon');
    expect(quote.countryTo).toBe('Portugal');
    expect(quote.price).toBe(387);
    // Distance: 6826.4 km * 0.621371 ≈ 4241 miles
    expect(quote.distance).toBeGreaterThan(4000);
    expect(quote.distance).toBeLessThan(4500);
    expect(quote.deepLink).toContain('kiwi.com');
    expect(quote.fetchedAt).toBe(FETCHED_AT);
  });

  it('uses curated lat/lon and themes for known destinations', () => {
    const quote = mapResultToFareQuote(SAMPLE_RESULT, FETCHED_AT);

    // LIS is in our dataset: lat ~38.77, lon ~-9.13, themes include beach/city/food
    expect(quote.lat).toBeCloseTo(38.77, 0);
    expect(quote.lon).toBeCloseTo(-9.13, 0);
    // Dataset expanded 2026-06 (3.3k airports, generated themes): LIS carries beach+food.
    expect(quote.themes).toContain('beach');
    expect(quote.themes).toContain('food');
  });

  it('gracefully handles destinations not in our curated dataset', () => {
    const quote = mapResultToFareQuote(SAMPLE_UNKNOWN_CITY, FETCHED_AT);

    expect(quote.flyTo).toBe('TBS');
    expect(quote.cityTo).toBe('Tbilisi');
    expect(quote.countryTo).toBe('Georgia');
    // Dataset expanded 2026-06: TBS now resolves to real coordinates (better, not a regression).
    expect(quote.lat).toBeCloseTo(41.67, 0);
    expect(quote.lon).toBeCloseTo(44.95, 0);
    expect(Array.isArray(quote.themes)).toBe(true);
    // Price and distance still map correctly
    expect(quote.price).toBe(612);
    expect(quote.distance).toBeGreaterThan(6000);
  });

  it('converts distance from km to miles', () => {
    const quote = mapResultToFareQuote(SAMPLE_RESULT, FETCHED_AT);
    const expectedMiles = Math.round(6826.4 * 0.621371);
    expect(quote.distance).toBe(expectedMiles);
  });

  it('preserves the deep_link as deepLink', () => {
    const quote = mapResultToFareQuote(SAMPLE_RESULT, FETCHED_AT);
    expect(quote.deepLink).toBe(SAMPLE_RESULT.deep_link);
  });
});

describe('TequilaProvider constructor', () => {
  it('throws when no API key is provided', () => {
    expect(() => new TequilaProvider({ apiKey: '' })).toThrow('TEQUILA_API_KEY');
  });

  it('accepts a valid API key without throwing', () => {
    expect(() => new TequilaProvider({ apiKey: 'test-key-123' })).not.toThrow();
  });

  it('accepts a custom base URL', () => {
    const provider = new TequilaProvider({
      apiKey: 'test-key',
      baseUrl: 'https://custom.api.example.com',
    });
    expect(provider).toBeDefined();
  });
});
