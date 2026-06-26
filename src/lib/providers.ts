/**
 * Provider setup utility.
 *
 * Instantiates the FlightProvider from @travelboard/core based on environment
 * variables. Uses AggregateProvider when FLIGHT_PROVIDER=aggregate (or when
 * multiple provider keys are available), so deals are sourced from all
 * available APIs in parallel and the best price wins.
 *
 * Priority:
 *   1. KiwiGraphQLProvider — always included (public, no key needed)
 *   2. TravelpayoutsProvider — included when TRAVELPAYOUTS_TOKEN is set
 *   3. TequilaProvider — included when TEQUILA_API_KEY is set
 */

import {
  KiwiGraphQLProvider,
  TequilaProvider,
  TravelpayoutsProvider,
  AggregateProvider,
  type FlightProvider,
} from "@travelboard/core";

let _provider: FlightProvider | null = null;

export function getFlightProvider(): FlightProvider {
  if (_provider) return _provider;

  const tequilaKey = process.env.TEQUILA_API_KEY;
  const travelpayoutsToken = process.env.TRAVELPAYOUTS_TOKEN;
  const flightProvider = process.env.FLIGHT_PROVIDER;

  // Build aggregate when explicitly requested OR when we have extra provider keys.
  const useAggregate = flightProvider === "aggregate" || !!travelpayoutsToken || !!tequilaKey;

  if (useAggregate) {
    const sources: Array<{ name: string; provider: FlightProvider }> = [
      { name: "kiwi", provider: new KiwiGraphQLProvider() },
    ];

    if (travelpayoutsToken) {
      sources.push({
        name: "tp-latest",
        provider: new TravelpayoutsProvider({ apiToken: travelpayoutsToken }),
      });
    }

    if (tequilaKey) {
      sources.push({
        name: "tequila",
        provider: new TequilaProvider({ apiKey: tequilaKey }),
      });
    }

    _provider = new AggregateProvider({ sources });
    return _provider;
  }

  // Fallback: KiwiGraphQLProvider uses Kiwi.com's public GraphQL API — no key required.
  _provider = new KiwiGraphQLProvider();
  return _provider;
}
