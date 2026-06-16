/**
 * Provider setup utility.
 *
 * Instantiates the FlightProvider from @travelboard/core based on environment
 * variables. Defaults to MockTequilaProvider so the app runs with zero API keys.
 */

import {
  MockTequilaProvider,
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
    _provider = new MockTequilaProvider();
  }

  return _provider;
}
