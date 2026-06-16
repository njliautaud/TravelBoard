/**
 * HC #615 — curated WORLDWIDE vacation destinations ("real vacations, not just
 * local USA hops").
 *
 * The price-sorted "cheapest anywhere" feeds (Travelpayouts latest, Kiwi
 * one-per-city sorted by price) structurally favor short domestic routes: the
 * cheapest 100–200 results from a US origin are almost all US cities. This list
 * gives the Kiwi provider an explicit destination set to ALSO quote, so iconic
 * international vacation spots (Europe, Asia, Caribbean, South America, Africa,
 * Oceania) always get a real round-trip price on the board — each with its own
 * dot on the world map.
 *
 * Keyless Kiwi GraphQL is the fetch path (ONE extra query per origin+month
 * warm). seats.aero is NOT touched by this list — award lookups stay on their
 * own cached budget.
 *
 * Codes must exist in DESTINATIONS / INTERNATIONAL_AIRPORTS so coords resolve.
 */

export type VacationRegion =
  | 'europe'
  | 'asia'
  | 'caribbean'
  | 'central-america'
  | 'south-america'
  | 'oceania'
  | 'africa-middle-east'
  | 'north-america';

export interface VacationSpot {
  code: string;
  region: VacationRegion;
}

export const VACATION_SPOTS: VacationSpot[] = [
  // --- Europe ---
  { code: 'LIS', region: 'europe' }, { code: 'BCN', region: 'europe' },
  { code: 'MAD', region: 'europe' }, { code: 'CDG', region: 'europe' },
  { code: 'NCE', region: 'europe' }, { code: 'FCO', region: 'europe' },
  { code: 'VCE', region: 'europe' }, { code: 'NAP', region: 'europe' },
  { code: 'ATH', region: 'europe' }, { code: 'JTR', region: 'europe' },
  { code: 'LHR', region: 'europe' }, { code: 'DUB', region: 'europe' },
  { code: 'EDI', region: 'europe' }, { code: 'AMS', region: 'europe' },
  { code: 'BRU', region: 'europe' }, { code: 'ZRH', region: 'europe' },
  { code: 'VIE', region: 'europe' }, { code: 'PRG', region: 'europe' },
  { code: 'BUD', region: 'europe' }, { code: 'KRK', region: 'europe' },
  { code: 'CPH', region: 'europe' }, { code: 'OSL', region: 'europe' },
  { code: 'ARN', region: 'europe' }, { code: 'HEL', region: 'europe' },
  { code: 'KEF', region: 'europe' }, { code: 'OPO', region: 'europe' },
  { code: 'SVQ', region: 'europe' }, { code: 'PMI', region: 'europe' },
  { code: 'MLA', region: 'europe' }, { code: 'DBV', region: 'europe' },
  { code: 'SPU', region: 'europe' }, { code: 'TIA', region: 'europe' },
  { code: 'IST', region: 'europe' }, { code: 'MUC', region: 'europe' },
  { code: 'BER', region: 'europe' },
  // --- Asia ---
  { code: 'NRT', region: 'asia' }, { code: 'KIX', region: 'asia' },
  { code: 'ICN', region: 'asia' }, { code: 'TPE', region: 'asia' },
  { code: 'HKG', region: 'asia' }, { code: 'BKK', region: 'asia' },
  { code: 'HKT', region: 'asia' }, { code: 'CNX', region: 'asia' },
  { code: 'SIN', region: 'asia' }, { code: 'KUL', region: 'asia' },
  { code: 'DPS', region: 'asia' }, { code: 'CGK', region: 'asia' },
  { code: 'MNL', region: 'asia' }, { code: 'CEB', region: 'asia' },
  { code: 'SGN', region: 'asia' }, { code: 'HAN', region: 'asia' },
  { code: 'DAD', region: 'asia' }, { code: 'PNH', region: 'asia' },
  { code: 'DEL', region: 'asia' }, { code: 'BOM', region: 'asia' },
  { code: 'GOI', region: 'asia' }, { code: 'CMB', region: 'asia' },
  { code: 'MLE', region: 'asia' }, { code: 'KTM', region: 'asia' },
  // --- Caribbean ---
  { code: 'SJU', region: 'caribbean' }, { code: 'PUJ', region: 'caribbean' },
  { code: 'SDQ', region: 'caribbean' }, { code: 'MBJ', region: 'caribbean' },
  { code: 'KIN', region: 'caribbean' }, { code: 'NAS', region: 'caribbean' },
  { code: 'AUA', region: 'caribbean' }, { code: 'CUR', region: 'caribbean' },
  { code: 'BGI', region: 'caribbean' }, { code: 'UVF', region: 'caribbean' },
  { code: 'ANU', region: 'caribbean' }, { code: 'SXM', region: 'caribbean' },
  { code: 'GCM', region: 'caribbean' }, { code: 'PLS', region: 'caribbean' },
  { code: 'STT', region: 'caribbean' }, { code: 'POS', region: 'caribbean' },
  { code: 'HAV', region: 'caribbean' },
  // --- Central America + Mexico ---
  { code: 'CUN', region: 'central-america' }, { code: 'CZM', region: 'central-america' },
  { code: 'PVR', region: 'central-america' }, { code: 'SJD', region: 'central-america' },
  { code: 'MEX', region: 'central-america' }, { code: 'OAX', region: 'central-america' },
  { code: 'SJO', region: 'central-america' }, { code: 'LIR', region: 'central-america' },
  { code: 'PTY', region: 'central-america' }, { code: 'BZE', region: 'central-america' },
  { code: 'GUA', region: 'central-america' }, { code: 'RTB', region: 'central-america' },
  // --- South America ---
  { code: 'GIG', region: 'south-america' }, { code: 'GRU', region: 'south-america' },
  { code: 'EZE', region: 'south-america' }, { code: 'SCL', region: 'south-america' },
  { code: 'LIM', region: 'south-america' }, { code: 'CUZ', region: 'south-america' },
  { code: 'BOG', region: 'south-america' }, { code: 'MDE', region: 'south-america' },
  { code: 'CTG', region: 'south-america' }, { code: 'UIO', region: 'south-america' },
  { code: 'GPS', region: 'south-america' }, { code: 'MVD', region: 'south-america' },
  // --- Oceania ---
  { code: 'SYD', region: 'oceania' }, { code: 'MEL', region: 'oceania' },
  { code: 'BNE', region: 'oceania' }, { code: 'AKL', region: 'oceania' },
  { code: 'ZQN', region: 'oceania' }, { code: 'NAN', region: 'oceania' },
  { code: 'PPT', region: 'oceania' }, { code: 'RAR', region: 'oceania' },
  // --- Africa + Middle East ---
  { code: 'CPT', region: 'africa-middle-east' }, { code: 'JNB', region: 'africa-middle-east' },
  { code: 'NBO', region: 'africa-middle-east' }, { code: 'ZNZ', region: 'africa-middle-east' },
  { code: 'MRU', region: 'africa-middle-east' }, { code: 'SEZ', region: 'africa-middle-east' },
  { code: 'RAK', region: 'africa-middle-east' }, { code: 'CMN', region: 'africa-middle-east' },
  { code: 'CAI', region: 'africa-middle-east' }, { code: 'TLV', region: 'africa-middle-east' },
  { code: 'AMM', region: 'africa-middle-east' }, { code: 'DXB', region: 'africa-middle-east' },
  { code: 'AUH', region: 'africa-middle-east' }, { code: 'DOH', region: 'africa-middle-east' },
  // --- North America (the non-obvious vacation set, not commuter hops) ---
  { code: 'HNL', region: 'north-america' }, { code: 'OGG', region: 'north-america' },
  { code: 'KOA', region: 'north-america' }, { code: 'LIH', region: 'north-america' },
  { code: 'ANC', region: 'north-america' }, { code: 'YVR', region: 'north-america' },
  { code: 'YYZ', region: 'north-america' }, { code: 'YUL', region: 'north-america' },
];

/** IATA codes only — what the Kiwi provider feeds into the destination filter. */
export const VACATION_CODES: string[] = VACATION_SPOTS.map((v) => v.code);

const REGION_BY_CODE = new Map(VACATION_SPOTS.map((v) => [v.code, v.region]));

export function vacationRegionFor(code: string): VacationRegion | null {
  return REGION_BY_CODE.get(code) ?? null;
}
