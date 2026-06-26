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
} from './types';

// Provider boundary (sacred interface)
export type {
  FareQuote,
  GetCheapestOptions,
  FlightProvider,
  FlightTelemetry,
  FlightTrackerProvider,
} from './providers/types';
export { MockTequilaProvider } from './providers/mock-tequila';
export { TequilaProvider, type TequilaProviderOptions } from './providers/tequila';
export { TravelpayoutsProvider, type TravelpayoutsProviderOptions } from './providers/travelpayouts';
export { KiwiGraphQLProvider, type KiwiGraphQLProviderOptions } from './providers/kiwi-graphql';
export { TravelpayoutsDirectionsProvider, type TravelpayoutsDirectionsProviderOptions } from './providers/travelpayouts-directions';
export { AmadeusProvider, type AmadeusProviderOptions } from './providers/amadeus';
export { AggregateProvider, type AggregateProviderOptions, type AggregateSource } from './providers/aggregate';
export { MockFlightTracker } from './providers/mock-tracker';
export { OpenSkyProvider, type OpenSkyProviderOptions } from './providers/opensky';
export { AirLabsProvider, type AirLabsProviderOptions } from './providers/airlabs';
export {
  CompositeFlightTracker,
  type CompositeTrackerOptions,
} from './providers/composite-tracker';
export {
  RetryProvider,
  CircuitBreaker,
  type RetryOptions,
  type CircuitBreakerOptions,
  type CircuitState,
} from './providers/resilience';

// Data
export { DESTINATIONS, findDestination } from './data/destinations';
export { SEASONAL_ACTIVITIES, activitiesFor, type SeasonalActivity } from './data/seasonal_activities';
export { METRO_TO_AIRPORT, resolveMetro } from './data/metros';
export { HUB_CLUSTERS, hubsForHome, isHomeHub } from './data/hubs';
export { CONTINENT_POLYGONS } from './data/continents';
export { COUNTRY_BORDERS } from './data/borders';
export { POPULATED_PLACES, type PopulatedPlace } from './data/places';
export {
  INTERNATIONAL_AIRPORTS,
  ORIGIN_AIRPORTS,
  findAirport,
  getAirport,
  getAirportsByRegion,
  searchAirports,
  type InternationalAirport,
} from './data/airports';

// Fares
export { hash01, seasonalFactor, estimateFare } from './fares/model';
export {
  TIER_COLORS,
  tierForPrice,
  tierFares,
  type TieringOptions,
} from './fares/tiering';
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
} from './fares/feasibility';
export {
  DEFAULT_MAX_NIGHTS,
  LONG_STAY_THRESHOLD_NIGHTS,
  durationBandForDistance,
  defaultProviderNightsWindow,
  clampToConsumerCap,
  isLongStay,
  nightsBetween,
  type DurationBand,
} from './fares/duration-bands';

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
} from './points/types';
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
} from './points/data/transfer-partners';
export { SourceRunner, fetchText, BROWSER_UA } from './points/sources/adapter';
export {
  FrequentMilerBonusesAdapter,
  parseFrequentMilerBonuses,
  parseFmDate,
} from './points/sources/frequentmiler-bonuses';
export { RssNewsAdapter, parseRssItems, type PointsNewsItem } from './points/sources/rss-news';
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
} from './points/sources/seats-aero';
export {
  SeatsAeroBulkAdapter,
  parseBulkRecord,
  DEFAULT_BULK_SOURCES,
  type BulkAwardRecord,
  type SeatsAeroBulkAdapterOptions,
} from './points/sources/seats-aero-bulk';
export {
  generateAwardDeals,
  benchmarkMiles,
  rankScore,
  awardDealSummary,
  type AwardDeal,
  type AirportInfo,
  type GenerateAwardDealsOptions,
} from './points/award-deals';
export {
  valuateDeal,
  estimateAwardMiles,
  transferablePrograms,
  valuateVerifiedCabin,
  SEATS_SOURCE_TO_PARTNER,
  CABIN_FARE_MULTIPLIERS,
  type ValuationInputs,
  type VerifiedCabinValuationInputs,
} from './points/valuation';

// Geo
export {
  EARTH_RADIUS_MILES,
  haversineMiles,
  greatCirclePoints,
  interpolateGreatCircle,
  project,
  subsolarPoint,
  isDaylight,
} from './geo';

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
} from './map/renderer';
export { countryNameToISO2 } from './data/country_iso2';
export { VACATION_SPOTS, VACATION_CODES, vacationRegionFor, type VacationSpot, type VacationRegion } from "./data/vacations";
