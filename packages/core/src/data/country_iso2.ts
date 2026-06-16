/**
 * Country full-name → ISO-3166-1 alpha-2 mapper.
 *
 * Our airports dataset stores `country` as the human-readable name ("USA", "Japan", "France").
 * The holidays + climate APIs we integrate (nager.at, frankfurter.app) key off ISO-2 codes.
 * This is a hand-curated table for the top destinations the board surfaces; unknown countries
 * return undefined and the caller silently skips enrichment for that fare.
 *
 * Why not a runtime package: the canonical ISO-3166 lists are large and overkill — most of our
 * destinations cluster in a few dozen countries. A static table keeps the bundle small and
 * the lookup synchronous.
 */

const NAME_TO_ISO2: Record<string, string> = {
  // North America
  'usa': 'US',
  'united states': 'US',
  'united states of america': 'US',
  'us': 'US',
  'canada': 'CA',
  'mexico': 'MX',
  'cuba': 'CU',
  'dominican republic': 'DO',
  'jamaica': 'JM',
  'bahamas': 'BS',
  'costa rica': 'CR',
  'panama': 'PA',
  'guatemala': 'GT',
  'honduras': 'HN',
  'el salvador': 'SV',
  'belize': 'BZ',
  'puerto rico': 'PR',
  'haiti': 'HT',
  'trinidad and tobago': 'TT',
  'barbados': 'BB',
  // South America
  'brazil': 'BR',
  'argentina': 'AR',
  'chile': 'CL',
  'peru': 'PE',
  'colombia': 'CO',
  'ecuador': 'EC',
  'uruguay': 'UY',
  'paraguay': 'PY',
  'bolivia': 'BO',
  'venezuela': 'VE',
  // Europe
  'united kingdom': 'GB',
  'uk': 'GB',
  'great britain': 'GB',
  'england': 'GB',
  'ireland': 'IE',
  'france': 'FR',
  'germany': 'DE',
  'spain': 'ES',
  'portugal': 'PT',
  'italy': 'IT',
  'netherlands': 'NL',
  'belgium': 'BE',
  'switzerland': 'CH',
  'austria': 'AT',
  'sweden': 'SE',
  'norway': 'NO',
  'denmark': 'DK',
  'finland': 'FI',
  'iceland': 'IS',
  'poland': 'PL',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'hungary': 'HU',
  'greece': 'GR',
  'romania': 'RO',
  'bulgaria': 'BG',
  'croatia': 'HR',
  'serbia': 'RS',
  'slovenia': 'SI',
  'slovakia': 'SK',
  'estonia': 'EE',
  'latvia': 'LV',
  'lithuania': 'LT',
  'luxembourg': 'LU',
  'malta': 'MT',
  'cyprus': 'CY',
  'russia': 'RU',
  'ukraine': 'UA',
  'turkey': 'TR',
  // Asia
  'china': 'CN',
  'japan': 'JP',
  'south korea': 'KR',
  'korea': 'KR',
  'india': 'IN',
  'thailand': 'TH',
  'vietnam': 'VN',
  'indonesia': 'ID',
  'philippines': 'PH',
  'malaysia': 'MY',
  'singapore': 'SG',
  'taiwan': 'TW',
  'hong kong': 'HK',
  'sri lanka': 'LK',
  'pakistan': 'PK',
  'bangladesh': 'BD',
  'cambodia': 'KH',
  'laos': 'LA',
  'myanmar': 'MM',
  'nepal': 'NP',
  'mongolia': 'MN',
  // Middle East
  'uae': 'AE',
  'united arab emirates': 'AE',
  'qatar': 'QA',
  'saudi arabia': 'SA',
  'israel': 'IL',
  'jordan': 'JO',
  'lebanon': 'LB',
  'oman': 'OM',
  'kuwait': 'KW',
  'bahrain': 'BH',
  'iran': 'IR',
  'iraq': 'IQ',
  // Africa
  'egypt': 'EG',
  'morocco': 'MA',
  'south africa': 'ZA',
  'kenya': 'KE',
  'tanzania': 'TZ',
  'ethiopia': 'ET',
  'nigeria': 'NG',
  'ghana': 'GH',
  'tunisia': 'TN',
  'algeria': 'DZ',
  'mauritius': 'MU',
  'seychelles': 'SC',
  // Oceania
  'australia': 'AU',
  'new zealand': 'NZ',
  'fiji': 'FJ',
  'papua new guinea': 'PG',
};

/**
 * Resolve a human-readable country name to its ISO-3166-1 alpha-2 code.
 * Case-insensitive. Returns undefined if unknown (caller should skip enrichment).
 */
export function countryNameToISO2(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  // Some providers send the alpha-2 directly; honour it without a map lookup.
  if (key.length === 2 && /^[a-z]{2}$/.test(key)) return key.toUpperCase();
  return NAME_TO_ISO2[key];
}
