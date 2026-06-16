/**
 * HC #618 R2 — major-hub anchor table.
 *
 * Owner: "showing me deals from toronto when im in orlando is cool sure ...
 * most trips should be from their airport or the CLOSEST MAIN ONE.
 * like MIA for orlando."
 *
 * Each entry maps a HOME-airport IATA to the cluster of nearby major hubs
 * a traveler would realistically position to. Used by getCheapestHubs(home)
 * to anchor the default deal feed (wall + map highlight + verified-award
 * strip) on origins that actually make sense for the user.
 *
 * Curation rule: a hub is "nearby" when it is within ~250-400 statute miles
 * driving range OR is the primary international gateway for that metro
 * (e.g. ATL for the southeast, ORD for the midwest). The set is curated, not
 * exhaustive — any home airport without an entry just uses itself.
 */

export interface HubCluster {
  /** the home airport IATA */
  home: string;
  /** ordered list of major-hub origins (best first, includes `home`) */
  hubs: readonly string[];
}

/** Major-hub clusters keyed by home IATA. */
export const HUB_CLUSTERS: Readonly<Record<string, readonly string[]>> = {
  // --- USA ---
  // Florida
  MCO: ['MCO', 'MIA', 'FLL', 'TPA'],
  SFB: ['MCO', 'MIA', 'FLL', 'TPA'],
  MIA: ['MIA', 'FLL', 'MCO'],
  FLL: ['FLL', 'MIA', 'MCO'],
  TPA: ['TPA', 'MCO', 'MIA'],
  JAX: ['JAX', 'MCO', 'ATL'],
  RSW: ['RSW', 'MIA', 'MCO', 'TPA'],
  PNS: ['PNS', 'TPA', 'ATL'],

  // NYC cluster
  JFK: ['JFK', 'LGA', 'EWR'],
  LGA: ['LGA', 'JFK', 'EWR'],
  EWR: ['EWR', 'JFK', 'LGA'],
  HPN: ['HPN', 'JFK', 'LGA', 'EWR'],
  ISP: ['ISP', 'JFK', 'LGA'],

  // SoCal
  LAX: ['LAX', 'SNA', 'BUR', 'LGB', 'ONT', 'SAN'],
  SAN: ['SAN', 'LAX', 'SNA'],
  BUR: ['BUR', 'LAX', 'ONT', 'SNA'],
  SNA: ['SNA', 'LAX', 'LGB', 'ONT'],
  ONT: ['ONT', 'LAX', 'SNA', 'BUR'],
  LGB: ['LGB', 'LAX', 'SNA', 'ONT'],

  // Chicago
  ORD: ['ORD', 'MDW'],
  MDW: ['MDW', 'ORD'],
  MKE: ['MKE', 'ORD', 'MDW'],

  // SF Bay
  SFO: ['SFO', 'OAK', 'SJC'],
  OAK: ['OAK', 'SFO', 'SJC'],
  SJC: ['SJC', 'SFO', 'OAK'],
  SMF: ['SMF', 'SFO', 'OAK'],

  // Boston / NE
  BOS: ['BOS', 'PVD', 'MHT'],
  PVD: ['PVD', 'BOS'],
  MHT: ['MHT', 'BOS'],
  PWM: ['PWM', 'BOS'],

  // Texas
  DFW: ['DFW', 'DAL'],
  DAL: ['DAL', 'DFW'],
  IAH: ['IAH', 'HOU'],
  HOU: ['HOU', 'IAH'],
  AUS: ['AUS', 'DFW', 'IAH'],
  SAT: ['SAT', 'AUS', 'IAH', 'DFW'],

  // DC / Mid-Atlantic
  DCA: ['DCA', 'IAD', 'BWI'],
  IAD: ['IAD', 'DCA', 'BWI'],
  BWI: ['BWI', 'DCA', 'IAD'],

  // Southeast hubs
  ATL: ['ATL'],
  CLT: ['CLT', 'ATL'],
  RDU: ['RDU', 'CLT', 'ATL'],
  RIC: ['RIC', 'DCA', 'CLT'],
  BNA: ['BNA', 'ATL'],
  MEM: ['MEM', 'BNA', 'ATL'],
  MSY: ['MSY', 'IAH', 'ATL'],

  // Pacific NW
  SEA: ['SEA', 'PDX'],
  PDX: ['PDX', 'SEA'],

  // Mountain / Plains
  DEN: ['DEN'],
  COS: ['COS', 'DEN'],
  PHX: ['PHX', 'TUS'],
  TUS: ['TUS', 'PHX'],
  SLC: ['SLC'],
  LAS: ['LAS'],
  ABQ: ['ABQ', 'PHX', 'DEN'],

  // Midwest secondaries
  MSP: ['MSP'],
  STL: ['STL', 'ORD', 'MDW'],
  MCI: ['MCI', 'STL', 'ORD'],
  IND: ['IND', 'ORD', 'CVG'],
  CMH: ['CMH', 'CLE', 'CVG'],
  CLE: ['CLE', 'DTW', 'CMH'],
  DTW: ['DTW', 'CLE'],
  CVG: ['CVG', 'CMH', 'CLE'],
  PIT: ['PIT', 'PHL', 'CLE'],
  PHL: ['PHL', 'BWI', 'EWR'],

  // Hawaii / Alaska
  HNL: ['HNL', 'OGG'],
  OGG: ['OGG', 'HNL'],
  ANC: ['ANC'],

  // --- Canada ---
  YYZ: ['YYZ', 'YHM'],
  YUL: ['YUL', 'YOW'],
  YVR: ['YVR'],
  YYC: ['YYC', 'YEG'],
  YEG: ['YEG', 'YYC'],
  YOW: ['YOW', 'YUL'],
  YWG: ['YWG'],

  // --- Mexico ---
  MEX: ['MEX'],
  CUN: ['CUN'],
  GDL: ['GDL', 'MEX'],
  MTY: ['MTY', 'MEX'],

  // --- UK / Ireland ---
  LHR: ['LHR', 'LGW', 'LCY', 'STN', 'LTN'],
  LGW: ['LGW', 'LHR', 'LCY', 'STN', 'LTN'],
  STN: ['STN', 'LGW', 'LHR', 'LTN'],
  LTN: ['LTN', 'LHR', 'LGW', 'STN'],
  LCY: ['LCY', 'LHR', 'LGW'],
  MAN: ['MAN', 'LBA'],
  EDI: ['EDI', 'GLA'],
  GLA: ['GLA', 'EDI'],
  DUB: ['DUB', 'ORK'],

  // --- Western Europe ---
  CDG: ['CDG', 'ORY', 'BVA'],
  ORY: ['ORY', 'CDG', 'BVA'],
  AMS: ['AMS', 'RTM', 'EIN'],
  BRU: ['BRU', 'CRL'],
  FRA: ['FRA', 'HHN'],
  MUC: ['MUC'],
  BER: ['BER'],
  HAM: ['HAM'],
  DUS: ['DUS', 'CGN'],
  ZRH: ['ZRH', 'BSL'],
  VIE: ['VIE', 'BTS'],
  MAD: ['MAD'],
  BCN: ['BCN', 'GRO', 'REU'],
  LIS: ['LIS', 'OPO'],
  FCO: ['FCO', 'CIA'],
  MXP: ['MXP', 'LIN', 'BGY'],
  CPH: ['CPH', 'MMX'],
  ARN: ['ARN', 'BMA', 'NYO'],
  OSL: ['OSL', 'TRF'],
  HEL: ['HEL'],

  // --- Asia ---
  HND: ['HND', 'NRT'],
  NRT: ['NRT', 'HND'],
  KIX: ['KIX', 'ITM'],
  ICN: ['ICN', 'GMP'],
  PEK: ['PEK', 'PKX'],
  PVG: ['PVG', 'SHA'],
  HKG: ['HKG', 'SZX', 'CAN'],
  TPE: ['TPE', 'TSA'],
  SIN: ['SIN'],
  BKK: ['BKK', 'DMK'],
  KUL: ['KUL', 'SZB'],
  MNL: ['MNL', 'CRK'],
  CGK: ['CGK', 'HLP'],
  DEL: ['DEL'],
  BOM: ['BOM'],
  BLR: ['BLR'],
  HAN: ['HAN'],
  SGN: ['SGN'],

  // --- Middle East ---
  DXB: ['DXB', 'DWC', 'SHJ', 'AUH'],
  AUH: ['AUH', 'DXB'],
  DOH: ['DOH'],
  TLV: ['TLV'],
  IST: ['IST', 'SAW'],

  // --- Oceania ---
  SYD: ['SYD'],
  MEL: ['MEL', 'AVV'],
  BNE: ['BNE'],
  PER: ['PER'],
  AKL: ['AKL'],

  // --- LATAM ---
  GRU: ['GRU', 'CGH', 'VCP'],
  GIG: ['GIG', 'SDU'],
  EZE: ['EZE', 'AEP'],
  SCL: ['SCL'],
  BOG: ['BOG'],
  LIM: ['LIM'],
  PTY: ['PTY'],

  // --- Africa ---
  JNB: ['JNB'],
  CPT: ['CPT'],
  CAI: ['CAI'],
  NBO: ['NBO'],
  LOS: ['LOS'],
};

/**
 * Resolve the major-hub cluster for a home airport. When the home airport
 * has no curated cluster, falls back to itself plus any cluster that already
 * contains it as a hub (catches secondary airports we haven't keyed yet).
 */
export function hubsForHome(home: string): readonly string[] {
  const h = home.toUpperCase();
  const direct = HUB_CLUSTERS[h];
  if (direct?.length) return direct;
  // reverse lookup: home is a hub in some other cluster (rare; safety net)
  for (const cluster of Object.values(HUB_CLUSTERS)) {
    if (cluster.includes(h)) return cluster;
  }
  return [h];
}

/** True when an origin code is one of the home airport's major hubs. */
export function isHomeHub(home: string, origin: string): boolean {
  return hubsForHome(home).includes(origin.toUpperCase());
}
