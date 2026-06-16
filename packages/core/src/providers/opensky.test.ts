/**
 * Unit tests for the OpenSky provider mapper and callsign resolution.
 */

import { describe, it, expect } from "vitest";
import { flightToCallsigns, mapStateToTelemetry } from "./opensky.js";

describe("flightToCallsigns", () => {
  it("converts IATA flight number to ICAO callsign candidates", () => {
    const candidates = flightToCallsigns("UA123");
    expect(candidates).toContain("UAL123");
    expect(candidates).toContain("UA123");
  });

  it("handles Delta flights", () => {
    const candidates = flightToCallsigns("DL456");
    expect(candidates).toContain("DAL456");
  });

  it("handles already-ICAO callsigns", () => {
    const candidates = flightToCallsigns("UAL123");
    expect(candidates).toContain("UAL123");
  });

  it("falls back to raw string for unknown format", () => {
    const candidates = flightToCallsigns("WEIRD");
    expect(candidates).toContain("WEIRD");
  });

  it("deduplicates candidates", () => {
    const candidates = flightToCallsigns("UAL100");
    const unique = new Set(candidates);
    expect(candidates.length).toBe(unique.size);
  });
});

/** Realistic OpenSky state vector parsed into our typed object. */
const SAMPLE_STATE_VECTOR = {
  icao24: "a12345",
  callsign: "UAL123  ",
  origin_country: "United States",
  time_position: 1717340000,
  last_contact: 1717340005,
  longitude: -81.3,
  latitude: 28.4,
  baro_altitude: 10668, // meters (~35,000 ft)
  on_ground: false,
  velocity: 247.0, // m/s (~480 knots)
  true_track: 45.0,
  vertical_rate: 0.5,
  sensors: null,
  geo_altitude: 10700,
  squawk: "1200",
  spi: false,
  position_source: 0,
};

const FETCHED_AT = "2026-06-02T12:00:00.000Z";

describe("mapStateToTelemetry", () => {
  it("maps a flying aircraft to enroute status", () => {
    const t = mapStateToTelemetry(SAMPLE_STATE_VECTOR, "UA123", FETCHED_AT);

    expect(t.flight).toBe("UA123");
    expect(t.status).toBe("enroute");
    expect(t.position.lat).toBe(28.4);
    expect(t.position.lon).toBe(-81.3);
    expect(t.fetchedAt).toBe(FETCHED_AT);
  });

  it("converts altitude from meters to feet", () => {
    const t = mapStateToTelemetry(SAMPLE_STATE_VECTOR, "UA123", FETCHED_AT);
    // 10668m * 3.28084 ≈ 34,993 ft
    expect(t.altitude).toBeGreaterThan(34000);
    expect(t.altitude).toBeLessThan(36000);
  });

  it("converts speed from m/s to knots", () => {
    const t = mapStateToTelemetry(SAMPLE_STATE_VECTOR, "UA123", FETCHED_AT);
    // 247 m/s * 1.94384 ≈ 480 knots
    expect(t.speed).toBeGreaterThan(470);
    expect(t.speed).toBeLessThan(490);
  });

  it("maps on_ground=true to landed status", () => {
    const grounded = { ...SAMPLE_STATE_VECTOR, on_ground: true, baro_altitude: 10 };
    const t = mapStateToTelemetry(grounded, "UA123", FETCHED_AT);
    expect(t.status).toBe("landed");
    expect(t.progress).toBe(1.0);
  });

  it("handles null position gracefully", () => {
    const noPos = { ...SAMPLE_STATE_VECTOR, latitude: null, longitude: null };
    const t = mapStateToTelemetry(noPos, "UA123", FETCHED_AT);
    expect(t.position.lat).toBe(0);
    expect(t.position.lon).toBe(0);
  });

  it("sets from/to as unknown (OpenSky lacks route data)", () => {
    const t = mapStateToTelemetry(SAMPLE_STATE_VECTOR, "UA123", FETCHED_AT);
    expect(t.from.code).toBe("???");
    expect(t.to.code).toBe("???");
  });
});
