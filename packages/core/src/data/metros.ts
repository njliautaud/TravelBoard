/**
 * IATA city/metro codes mapped to a representative primary airport.
 *
 * Travelpayouts (and most fare aggregators) often return the IATA *metro* code
 * (e.g. NYC, LON, CHI) rather than a specific airport (JFK, LHR, ORD). Those
 * codes are NOT in the airports dataset, so without this mapping they fail to
 * resolve and end up with lat/lon=0 + empty seasonal activities.
 *
 * Source: IATA city codes (https://en.wikipedia.org/wiki/IATA_airport_code) -
 * curated to the codes Travelpayouts has been observed returning in the wild.
 * Add new entries as we see new metros come through the live cache.
 */
export const METRO_TO_AIRPORT: Record<string, string> = {
  // North America
  NYC: "JFK", CHI: "ORD", WAS: "DCA", LAX: "LAX", SFO: "SFO",
  HOU: "IAH", DFW: "DFW", MIA: "MIA", BOS: "BOS", PHL: "PHL", ATL: "ATL",
  DTT: "DTW", MKC: "MCI", QPG: "MSP", QMI: "MSP", QHO: "IAH",
  YTO: "YYZ", YMQ: "YUL", YEA: "YEG", YVR: "YVR",
  // Latin America
  BUE: "EZE", RIO: "GIG", SAO: "GRU", BHZ: "CNF", BSB: "BSB",
  MEX: "MEX", CUN: "CUN", BOG: "BOG", LIM: "LIM", SCL: "SCL",
  // Europe
  LON: "LHR", PAR: "CDG", MIL: "MXP", ROM: "FCO", BER: "BER",
  MOW: "SVO", STO: "ARN", OSL: "OSL", CPH: "CPH", HEL: "HEL",
  AMS: "AMS", BRU: "BRU", DUB: "DUB", LIS: "LIS", MAD: "MAD", BCN: "BCN",
  VIE: "VIE", ZRH: "ZRH", MUC: "MUC", FRA: "FRA", DUS: "DUS", HAM: "HAM",
  WAW: "WAW", BUH: "OTP", BUD: "BUD", PRG: "PRG", ATH: "ATH", IST: "IST",
  // Asia
  TYO: "HND", OSA: "KIX", SPK: "CTS", NGO: "NGO",
  SEL: "ICN", BJS: "PEK", SHA: "PVG", CGO: "CGO", CTU: "CTU",
  BOM: "BOM", DEL: "DEL", CCU: "CCU", BLR: "BLR", MAA: "MAA", HYD: "HYD",
  BKK: "BKK", SIN: "SIN", KUL: "KUL", MNL: "MNL", CGK: "CGK", JKT: "CGK",
  HKG: "HKG", TPE: "TPE", HAN: "HAN", SGN: "SGN",
  // Middle East / Africa
  DXB: "DXB", AUH: "AUH", DOH: "DOH", JED: "JED", RUH: "RUH", TLV: "TLV",
  CAI: "CAI", JNB: "JNB", CPT: "CPT", LOS: "LOS", NBO: "NBO", ADD: "ADD",
  // Oceania
  SYD: "SYD", MEL: "MEL", BNE: "BNE", PER: "PER", AKL: "AKL", WLG: "WLG",
  // US metros + secondaries that Travelpayouts has been seen returning
  SAC: "SMF", FMY: "RSW", JAX: "JAX", PNS: "PNS", BHM: "BHM", MSY: "MSY",
  CVG: "CVG", CLE: "CLE", CMH: "CMH", IND: "IND", MKE: "MKE", BUF: "BUF",
  ALB: "ALB", ROC: "ROC", ORF: "ORF", RIC: "RIC", CHA: "CHA", LIT: "LIT",
  OKC: "OKC", TUL: "TUL", ABQ: "ABQ", BOI: "BOI", RNO: "RNO", FAT: "FAT",
  PDX: "PDX", SLC: "SLC", PHX: "PHX", LAS: "LAS", SAN: "SAN", TUS: "TUS",
  // Latin America secondaries
  GDL: "GDL", MTY: "MTY", PVR: "PVR", CZM: "CZM", TIJ: "TIJ", BZE: "BZE",
  GYE: "GYE", UIO: "UIO", PTY: "PTY", SJO: "SJO", MGA: "MGA", SAL: "SAL",
  // European secondaries
  EDI: "EDI", MAN: "MAN", BHX: "BHX", LPL: "LPL", GLA: "GLA", BRS: "BRS",
  NCE: "NCE", LYS: "LYS", MRS: "MRS", TLS: "TLS", BOD: "BOD", NTE: "NTE",
  HAJ: "HAJ", STR: "STR", CGN: "CGN", NUE: "NUE", LEJ: "LEJ", BRE: "BRE",
  // Asia secondaries
  CAN: "CAN", SZX: "SZX", XIY: "XIY", KMG: "KMG", URC: "URC", WUH: "WUH",
  KIX: "KIX", FUK: "FUK", OKA: "OKA", CTS: "CTS", HND: "HND",
};

/** Resolve a (possibly metro) IATA to its representative airport code, or null. */
export function resolveMetro(code: string): string | null {
  const upper = code.toUpperCase();
  return METRO_TO_AIRPORT[upper] ?? null;
}
