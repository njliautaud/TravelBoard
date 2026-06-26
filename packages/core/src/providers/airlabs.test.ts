/**
 * Unit tests for the AirLabs provider mapper.
 * Uses a realistic sample payload based on the AirLabs /flights API response.
 */

import { describe, it, expect } from "vitest";
import { mapAirLabsToTelemetry, AirLabsProvider, type AirLabsFlightResult } from "./airlabs";

/** Realistic sample AirLabs flight result. */
const SAMPLE_FLIGHT: AirLabsFlightResult = {
  flight_iata: "UA123",
  flight_icao: "UAL123",
  dep_iata: "MCO",
  dep_icao: "KMCO",
  arr_iata: "LHR",
  arr_icao: "EGLL",
  status: "en-route",
  lat: 42.5,
  lng: -35.2,
  alt: 11278, // meters
  dir: 52,
  speed: 890, // km/h
  dep_lat: 28.4312,
  dep_lng: -81.308,
  arr_lat: 51.4706,
  arr_lng: -0.4619,
  percent: 62,
  eta: 1717345200,
  arr_estimated: "2026-06-02T18:30:00.000Z",
};

/** A landed flight. */
const SAMPLE_LANDED: AirLabsFlightResult = {
  flight_iata: "DL456",
  flight_icao: "DAL456",
  dep_iata: "JFK",
  dep_icao: "KJFK",
  arr_iata: "LAX",
  arr_icao: "KLAX",
  status: "landed",
  lat: 33.9425,
  lng: -118.408,
  alt: 0,
  dir: 270,
  speed: 0,
  dep_lat: 40.6413,
  dep_lng: -73.7781,
  arr_lat: 33.9425,
  arr_lng: -118.408,
  percent: 100,
};

const FETCHED_AT = "2026-06-02T15:00:00.000Z";

describe("mapAirLabsToTelemetry", () => {
  it("maps an en-route flight with correct fields", () => {
    const t = mapAirLabsToTelemetry(SAMPLE_FLIGHT, "UA123", FETCHED_AT);

    expect(t.flight).toBe("UA123");
    expect(t.status).toBe("enroute");
    expect(t.from.code).toBe("MCO");
    expect(t.to.code).toBe("LHR");
    expect(t.position.lat).toBe(42.5);
    expect(t.position.lon).toBe(-35.2);
    expect(t.fetchedAt).toBe(FETCHED_AT);
  });

  it("converts altitude from meters to feet", () => {
    const t = mapAirLabsToTelemetry(SAMPLE_FLIGHT, "UA123", FETCHED_AT);
    // 11278m * 3.28084 ≈ 36,994 ft
    expect(t.altitude).toBeGreaterThan(36000);
    expect(t.altitude).toBeLessThan(38000);
  });

  it("converts speed from km/h to knots", () => {
    const t = mapAirLabsToTelemetry(SAMPLE_FLIGHT, "UA123", FETCHED_AT);
    // 890 km/h * 0.539957 ≈ 481 knots
    expect(t.speed).toBeGreaterThan(475);
    expect(t.speed).toBeLessThan(490);
  });

  it("converts percent 0-100 to progress 0-1", () => {
    const t = mapAirLabsToTelemetry(SAMPLE_FLIGHT, "UA123", FETCHED_AT);
    expect(t.progress).toBeCloseTo(0.62, 2);
  });

  it("uses arr_estimated for ETA when available", () => {
    const t = mapAirLabsToTelemetry(SAMPLE_FLIGHT, "UA123", FETCHED_AT);
    expect(t.eta).toBe("2026-06-02T18:30:00.000Z");
  });

  it("falls back to eta unix timestamp when arr_estimated missing", () => {
    const noEstimated = { ...SAMPLE_FLIGHT, arr_estimated: undefined };
    const t = mapAirLabsToTelemetry(noEstimated, "UA123", FETCHED_AT);
    expect(t.eta).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("maps landed flight correctly", () => {
    const t = mapAirLabsToTelemetry(SAMPLE_LANDED, "DL456", FETCHED_AT);
    expect(t.status).toBe("landed");
    expect(t.progress).toBe(1.0);
    expect(t.altitude).toBe(0);
    expect(t.speed).toBe(0);
  });

  it("uses origin/destination lat/lon from response", () => {
    const t = mapAirLabsToTelemetry(SAMPLE_FLIGHT, "UA123", FETCHED_AT);
    expect(t.from.lat).toBeCloseTo(28.43, 1);
    expect(t.to.lat).toBeCloseTo(51.47, 1);
  });

  it("handles null fields gracefully", () => {
    const sparse: AirLabsFlightResult = {
      flight_iata: "XX999",
      flight_icao: null,
      dep_iata: null,
      dep_icao: null,
      arr_iata: null,
      arr_icao: null,
      status: "scheduled",
      lat: null,
      lng: null,
      alt: null,
      dir: null,
      speed: null,
    };
    const t = mapAirLabsToTelemetry(sparse, "XX999", FETCHED_AT);
    expect(t.position.lat).toBe(0);
    expect(t.position.lon).toBe(0);
    expect(t.altitude).toBe(0);
    expect(t.speed).toBe(0);
    expect(t.from.code).toBe("???");
    expect(t.to.code).toBe("???");
  });
});

describe("AirLabsProvider constructor", () => {
  it("throws when no API key is provided", () => {
    expect(() => new AirLabsProvider({ apiKey: "" })).toThrow("AIRLABS_API_KEY");
  });

  it("accepts a valid API key without throwing", () => {
    expect(() => new AirLabsProvider({ apiKey: "test-key-123" })).not.toThrow();
  });
});
