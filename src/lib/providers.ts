/**
 * Provider setup utility.
 *
 * Instantiates the FlightProvider from @travelboard/core based on environment
 * variables. Defaults to KiwiGraphQLProvider (no API key needed — uses the
 * same public endpoint that powers kiwi.com). Always returns real data.
 */

import {
  KiwiGraphQLProvider,
  TequilaProvider,
  type FlightProvider,
} from "@travelboard/core";

let _provider: FlightProvider | null = null;

export function getFlightProvider(): FlightProvider {
  if (_provider) return _provider;

  const tequilaKey = process.env.TEQUILA_API_KEY;
  if (tequilaKey) {
    _provider = new TequilaProvider({ apiKey: tequilaKey });
  } else {
    // KiwiGraphQLProvider uses Kiwi.com's public GraphQL API — no key required.
    _provider = new KiwiGraphQLProvider();
  }

  return _provider;
}
