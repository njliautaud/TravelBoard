/** @travelboard/core — shared types, providers, dataset, tiering, geo math, and the canvas map engine. */

// Types
export type {
  Theme,
  Region,
  GeoPoint,
  Airport,
  Destination,
  FareTier,
  TieredFare,
  Trip,
  TravelStats,
  Watch,
  BoardMode,
  BoardState,
} from './types.js';

// Provider boundary (sacred interface)
export type {
  FareQuote,
  GetCheapestOptions,
  FlightProvider,
  FlightTelemetry,
  FlightTrackerProvider,
} from './providers/types.js';
export { MockTequilaProvider } from './providers/mock-tequila.js';
export { TequilaProvider, type TequilaProviderOptions } from './providers/tequila.js';
export { TravelpayoutsProvider, type TravelpayoutsProviderOptions } from './providers/travelpayouts.js';
export { KiwiGraphQLProvider, type KiwiGraphQLProviderOptions } from './providers/kiwi-graphql.js';
export { TravelpayoutsDirectionsProvider, type TravelpayoutsDirectionsProviderOptions } from './providers/travelpayouts-directions.js';
export { AmadeusProvider, type AmadeusProviderOptions } from './providers/amadeus.js';
export { AggregateProvider, type AggregateProviderOptions, type AggregateSource } from './providers/aggregate.js';
export { MockFlightTracker } from './providers/mock-tracker.js';
export { OpenSkyProvider, type OpenSkyProviderOptions } from './providers/opensky.js';
export { AirLabsProvider, type AirLabsProviderOptions } from './providers/airlabs.js';
export {
  CompositeFlightTracker,
  type CompositeTrackerOptions,
} from './providers/composite-tracker.js';
export {
  RetryProvider,
  CircuitBreaker,
  type RetryOptions,
  type CircuitBreakerOptions,
  type CircuitState,
} from './providers/resilience.js';

// Data
export { DESTINATIONS, findDestination } from './data/destinations.js';
export { SEASONAL_ACTIVITIES, activitiesFor, type SeasonalActivity } from './data/seasonal_activities.js';
export { METRO_TO_AIRPORT, resolveMetro } from './data/metros.js';
export { HUB_CLUSTERS, hubsForHome, isHomeHub } from './data/hubs.js';
export { CONTINENT_POLYGONS } from './data/continents.js';
export { COUNTRY_BORDERS } from './data/borders.js';
export { POPULATED_PLACES, type PopulatedPlace } from './data/places.js';
export {
  INTERNATIONAL_AIRPORTS,
  ORIGIN_AIRPORTS,
  findAirport,
  getAirport,
  getAirportsByRegion,
  searchAirports,
  type InternationalAirport,
} from './data/airports.js';

// Fares
export { hash01, seasonalFactor, estimateFare } from './fares/model.js';
export {
  TIER_COLORS,
  tierForPrice,
  tierFares,
  type TieringOptions,
} from './fares/tiering.js';
export {
  DAY_TRIP_MIN_LAYOVER_MIN,
  DAY_TRIP_MAX_LAYOVER_MIN,
  estimateAirMinutes,
  estimateLayoverBounds,
  classifyDayTrip,
  exceedsMaxLayover,
  exceedsMaxTravelTime,
  type LayoverInput,
  type LayoverBounds,
  type AirTimeBounds,
  type DayTripKind,
  type DayTripAssessment,
} from './fares/feasibility.js';
export {
  DEFAULT_MAX_NIGHTS,
  LONG_STAY_THRESHOLD_NIGHTS,
  durationBandForDistance,
  defaultProviderNightsWindow,
  clampToConsumerCap,
  isLongStay,
  nightsBetween,
  type DurationBand,
} from './fares/duration-bands.js';

// Points-transfer game (HC #602)
export type {
  TransferableProgramId,
  CobrandProgramId,
  ProgramId,
  PointsProgram,
  TransferPartner,
  TransferEdge,
  TransferBonus,
  CardDefinition,
  HeldCard,
  PointsPath,
  PointsValuation,
  SourceKind,
  SourceStatus,
  SourceHealth,
  PointsSourceAdapter,
  SourceRunnerOptions,
  SourcePersistence,
  SourceResult,
} from './points/types.js';
export {
  DATASET_VERSION as POINTS_DATASET_VERSION,
  DATASET_UPDATED as POINTS_DATASET_UPDATED,
  PROGRAMS,
  PARTNERS,
  TRANSFER_EDGES,
  CARD_CATALOG,
  AWARD_CHARTS,
  PROGRAM_BY_ID,
  PARTNER_BY_ID,
  AWARD_CHART_BY_PARTNER,
} from './points/data/transfer-partners.js';
export { SourceRunner, fetchText, BROWSER_UA } from './points/sources/adapter.js';
export {
  FrequentMilerBonusesAdapter,
  parseFrequentMilerBonuses,
  parseFmDate,
} from './points/sources/frequentmiler-bonuses.js';
export { RssNewsAdapter, parseRssItems, type PointsNewsItem } from './points/sources/rss-news.js';
export {
  SeatsAeroAdapter,
  summarizeVerifiedAwards,
  SEATS_PROGRAM_NAMES,
  type AwardAvailability,
  type SeatsAeroAdapterOptions,
  type VerifiedAwardSummary,
  type VerifiedCabinAward,
  type VerifiedCabinValuation,
  CABINS,
  CABIN_LABELS,
  cabinOf,
  type Cabin,
  type CabinAvailability,
} from './points/sources/seats-aero.js';
export {
  SeatsAeroBulkAdapter,
  parseBulkRecord,
  DEFAULT_BULK_SOURCES,
  type BulkAwardRecord,
  type SeatsAeroBulkAdapterOptions,
} from './points/sources/seats-aero-bulk.js';
export {
  generateAwardDeals,
  benchmarkMiles,
  rankScore,
  awardDealSummary,
  type AwardDeal,
  type AirportInfo,
  type GenerateAwardDealsOptions,
} from './points/award-deals.js';
export {
  valuateDeal,
  estimateAwardMiles,
  transferablePrograms,
  valuateVerifiedCabin,
  SEATS_SOURCE_TO_PARTNER,
  CABIN_FARE_MULTIPLIERS,
  type ValuationInputs,
  type VerifiedCabinValuationInputs,
} from './points/valuation.js';

// Geo
export {
  EARTH_RADIUS_MILES,
  haversineMiles,
  greatCirclePoints,
  interpolateGreatCircle,
  project,
  subsolarPoint,
  isDaylight,
} from './geo.js';

// Map renderer
export {
  drawOcean,
  drawGraticule,
  drawLand,
  drawFares,
  AWARD_COLOR,
  drawTrips,
  drawFlight,
  drawTerminator,
  drawBorders,
  drawCityLabels,
  drawEdgeVignette,
  drawHeadline,
  drawLegend,
  type FareMarker,
  type HeadlineSpec,
  type OceanStyle,
  drawWishPins,
  type WishPin,
} from './map/renderer.js';
export { countryNameToISO2 } from './data/country_iso2.js';
export { VACATION_SPOTS, VACATION_CODES, vacationRegionFor, type VacationSpot, type VacationRegion } from "./data/vacations.js";
