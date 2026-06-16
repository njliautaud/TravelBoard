/**
 * Destination guides: brief info cards for popular destinations.
 * Static data: best time to visit, average temperatures, visa requirements
 * (US passport holder perspective), currency, time zone.
 */

export interface DestinationGuide {
  code: string;
  city: string;
  country: string;
  region: string;
  bestTimeToVisit: string;
  peakSeason: string;
  avgTempHighF: { summer: number; winter: number };
  avgTempLowF: { summer: number; winter: number };
  visaRequired: boolean;
  visaNote: string;
  currency: string;
  currencyCode: string;
  timeZone: string;
  utcOffset: string;
  languages: string[];
  highlights: string[];
  description: string;
}

const GUIDES: DestinationGuide[] = [
  {
    code: 'CUN', city: 'Cancun', country: 'Mexico', region: 'north-america',
    bestTimeToVisit: 'December through April (dry season)',
    peakSeason: 'Dec-Mar',
    avgTempHighF: { summer: 91, winter: 84 },
    avgTempLowF: { summer: 77, winter: 68 },
    visaRequired: false, visaNote: 'US passport holders: no visa, FMM tourist card on arrival (up to 180 days)',
    currency: 'Mexican Peso', currencyCode: 'MXN',
    timeZone: 'Eastern', utcOffset: 'UTC-5',
    languages: ['Spanish', 'English widely spoken in tourist areas'],
    highlights: ['Beach resorts', 'Mayan ruins (Chichen Itza, Tulum)', 'Cenotes', 'Isla Mujeres'],
    description: "Mexico's Caribbean coast: white sand beaches, ancient ruins, and all-inclusive resorts.",
  },
  {
    code: 'LHR', city: 'London', country: 'United Kingdom', region: 'europe',
    bestTimeToVisit: 'May through September (warmest, longest days)',
    peakSeason: 'Jun-Aug',
    avgTempHighF: { summer: 73, winter: 46 },
    avgTempLowF: { summer: 55, winter: 36 },
    visaRequired: false, visaNote: 'US passport: no visa needed for stays up to 6 months',
    currency: 'British Pound', currencyCode: 'GBP',
    timeZone: 'GMT / BST', utcOffset: 'UTC+0 / UTC+1',
    languages: ['English'],
    highlights: ['West End theatre', 'British Museum', 'Tower of London', 'Buckingham Palace'],
    description: 'History, culture, and pubs -- London has something for every traveler.',
  },
  {
    code: 'CDG', city: 'Paris', country: 'France', region: 'europe',
    bestTimeToVisit: 'April through June, September through October',
    peakSeason: 'Jun-Aug',
    avgTempHighF: { summer: 77, winter: 43 },
    avgTempLowF: { summer: 57, winter: 34 },
    visaRequired: false, visaNote: 'US passport: no visa for Schengen area stays up to 90 days',
    currency: 'Euro', currencyCode: 'EUR',
    timeZone: 'CET / CEST', utcOffset: 'UTC+1 / UTC+2',
    languages: ['French', 'English in tourist areas'],
    highlights: ['Eiffel Tower', 'Louvre Museum', 'Notre-Dame', 'Montmartre'],
    description: 'The City of Light: art, cuisine, and timeless elegance.',
  },
  {
    code: 'NRT', city: 'Tokyo', country: 'Japan', region: 'asia',
    bestTimeToVisit: 'March through May (cherry blossoms), October through November (foliage)',
    peakSeason: 'Mar-Apr, Oct-Nov',
    avgTempHighF: { summer: 86, winter: 49 },
    avgTempLowF: { summer: 72, winter: 34 },
    visaRequired: false, visaNote: 'US passport: no visa for stays up to 90 days',
    currency: 'Japanese Yen', currencyCode: 'JPY',
    timeZone: 'JST', utcOffset: 'UTC+9',
    languages: ['Japanese', 'Limited English -- translation apps helpful'],
    highlights: ['Shibuya Crossing', 'Senso-ji Temple', 'Tsukiji Outer Market', 'Mt. Fuji day trip'],
    description: 'Ancient temples meet neon-lit skyscrapers -- Tokyo is a sensory overload in the best way.',
  },
  {
    code: 'FCO', city: 'Rome', country: 'Italy', region: 'europe',
    bestTimeToVisit: 'April through June, September through October',
    peakSeason: 'Jun-Aug',
    avgTempHighF: { summer: 89, winter: 54 },
    avgTempLowF: { summer: 66, winter: 38 },
    visaRequired: false, visaNote: 'US passport: no visa for Schengen area stays up to 90 days',
    currency: 'Euro', currencyCode: 'EUR',
    timeZone: 'CET / CEST', utcOffset: 'UTC+1 / UTC+2',
    languages: ['Italian', 'English in tourist areas'],
    highlights: ['Colosseum', 'Vatican Museums', 'Trevi Fountain', 'Roman Forum'],
    description: 'Eternal City: 2,700 years of art, architecture, and incredible food.',
  },
  {
    code: 'BCN', city: 'Barcelona', country: 'Spain', region: 'europe',
    bestTimeToVisit: 'May through June, September through October',
    peakSeason: 'Jun-Aug',
    avgTempHighF: { summer: 84, winter: 57 },
    avgTempLowF: { summer: 68, winter: 43 },
    visaRequired: false, visaNote: 'US passport: no visa for Schengen area stays up to 90 days',
    currency: 'Euro', currencyCode: 'EUR',
    timeZone: 'CET / CEST', utcOffset: 'UTC+1 / UTC+2',
    languages: ['Spanish', 'Catalan', 'English in tourist areas'],
    highlights: ['Sagrada Familia', 'La Rambla', 'Park Guell', 'Gothic Quarter'],
    description: 'Beach city with Gaudi architecture, world-class food, and electric nightlife.',
  },
  {
    code: 'LIS', city: 'Lisbon', country: 'Portugal', region: 'europe',
    bestTimeToVisit: 'March through October',
    peakSeason: 'Jun-Sep',
    avgTempHighF: { summer: 82, winter: 58 },
    avgTempLowF: { summer: 63, winter: 47 },
    visaRequired: false, visaNote: 'US passport: no visa for Schengen area stays up to 90 days',
    currency: 'Euro', currencyCode: 'EUR',
    timeZone: 'WET / WEST', utcOffset: 'UTC+0 / UTC+1',
    languages: ['Portuguese', 'English widely spoken'],
    highlights: ['Belem Tower', 'Tram 28', 'Pasteis de Nata', 'Alfama neighborhood'],
    description: "Hilly, sun-drenched, and affordable -- Europe's best-kept-secret capital.",
  },
  {
    code: 'SJO', city: 'San Jose', country: 'Costa Rica', region: 'south-america',
    bestTimeToVisit: 'December through April (dry season)',
    peakSeason: 'Dec-Apr',
    avgTempHighF: { summer: 80, winter: 78 },
    avgTempLowF: { summer: 63, winter: 60 },
    visaRequired: false, visaNote: 'US passport: no visa for stays up to 90 days',
    currency: 'Costa Rican Colon', currencyCode: 'CRC',
    timeZone: 'CST', utcOffset: 'UTC-6',
    languages: ['Spanish', 'English in tourist areas'],
    highlights: ['Arenal Volcano', 'Monteverde Cloud Forest', 'Manuel Antonio', 'Zip-lining'],
    description: 'Rainforests, volcanoes, and wildlife -- pura vida in its purest form.',
  },
  {
    code: 'DPS', city: 'Bali', country: 'Indonesia', region: 'asia',
    bestTimeToVisit: 'April through October (dry season)',
    peakSeason: 'Jul-Aug',
    avgTempHighF: { summer: 86, winter: 86 },
    avgTempLowF: { summer: 75, winter: 75 },
    visaRequired: false, visaNote: 'US passport: visa on arrival (30 days, ~$35 USD)',
    currency: 'Indonesian Rupiah', currencyCode: 'IDR',
    timeZone: 'WITA', utcOffset: 'UTC+8',
    languages: ['Indonesian', 'Balinese', 'English in tourist areas'],
    highlights: ['Rice terraces', 'Temple ceremonies', 'Surfing', 'Ubud art scene'],
    description: 'Island of the Gods: temples, rice paddies, surf breaks, and spiritual retreats.',
  },
  {
    code: 'BKK', city: 'Bangkok', country: 'Thailand', region: 'asia',
    bestTimeToVisit: 'November through February (cool season)',
    peakSeason: 'Nov-Feb',
    avgTempHighF: { summer: 95, winter: 89 },
    avgTempLowF: { summer: 79, winter: 72 },
    visaRequired: false, visaNote: 'US passport: no visa for stays up to 30 days',
    currency: 'Thai Baht', currencyCode: 'THB',
    timeZone: 'ICT', utcOffset: 'UTC+7',
    languages: ['Thai', 'English in tourist areas'],
    highlights: ['Grand Palace', 'Street food', 'Floating markets', 'Night markets'],
    description: 'Temples, street food, and tuk-tuks -- Bangkok is organized chaos at its finest.',
  },
  {
    code: 'GIG', city: 'Rio de Janeiro', country: 'Brazil', region: 'south-america',
    bestTimeToVisit: 'May through October (cooler, drier winter)',
    peakSeason: 'Dec-Mar (Carnival Feb/Mar)',
    avgTempHighF: { summer: 89, winter: 77 },
    avgTempLowF: { summer: 75, winter: 64 },
    visaRequired: false, visaNote: 'US passport: no visa for stays up to 90 days (as of 2024)',
    currency: 'Brazilian Real', currencyCode: 'BRL',
    timeZone: 'BRT', utcOffset: 'UTC-3',
    languages: ['Portuguese', 'Limited English'],
    highlights: ['Christ the Redeemer', 'Copacabana Beach', 'Sugarloaf Mountain', 'Carnival'],
    description: 'Dramatic landscapes, samba rhythms, and beaches backed by jungle-clad mountains.',
  },
  {
    code: 'ICN', city: 'Seoul', country: 'South Korea', region: 'asia',
    bestTimeToVisit: 'April through May (spring), September through November (fall)',
    peakSeason: 'Apr-May, Sep-Oct',
    avgTempHighF: { summer: 85, winter: 34 },
    avgTempLowF: { summer: 72, winter: 19 },
    visaRequired: false, visaNote: 'US passport: K-ETA required (online, ~$10), stay up to 90 days',
    currency: 'South Korean Won', currencyCode: 'KRW',
    timeZone: 'KST', utcOffset: 'UTC+9',
    languages: ['Korean', 'English limited outside tourist areas'],
    highlights: ['Gyeongbokgung Palace', 'Myeongdong shopping', 'Korean BBQ', 'DMZ tours'],
    description: 'K-pop, palaces, and the best street food in Asia -- Seoul never sleeps.',
  },
  {
    code: 'KEF', city: 'Reykjavik', country: 'Iceland', region: 'europe',
    bestTimeToVisit: 'June through August (midnight sun), September through March (northern lights)',
    peakSeason: 'Jun-Aug',
    avgTempHighF: { summer: 57, winter: 36 },
    avgTempLowF: { summer: 46, winter: 27 },
    visaRequired: false, visaNote: 'US passport: no visa for Schengen area stays up to 90 days',
    currency: 'Icelandic Krona', currencyCode: 'ISK',
    timeZone: 'GMT', utcOffset: 'UTC+0',
    languages: ['Icelandic', 'English very widely spoken'],
    highlights: ['Blue Lagoon', 'Golden Circle', 'Northern Lights', 'Glacier hiking'],
    description: 'Fire and ice: volcanoes, glaciers, hot springs, and otherworldly landscapes.',
  },
  {
    code: 'MLE', city: 'Male', country: 'Maldives', region: 'asia',
    bestTimeToVisit: 'November through April (dry season)',
    peakSeason: 'Dec-Mar',
    avgTempHighF: { summer: 88, winter: 87 },
    avgTempLowF: { summer: 79, winter: 78 },
    visaRequired: false, visaNote: 'US passport: 30-day visa on arrival (free)',
    currency: 'Maldivian Rufiyaa', currencyCode: 'MVR',
    timeZone: 'MVT', utcOffset: 'UTC+5',
    languages: ['Dhivehi', 'English widely spoken in resorts'],
    highlights: ['Overwater bungalows', 'Snorkeling', 'Whale shark diving', 'Sandbank excursions'],
    description: 'Paradise defined: crystal-clear lagoons, coral reefs, and overwater villas.',
  },
];

const GUIDE_INDEX = new Map(GUIDES.map((g) => [g.code, g]));

export function getGuide(code: string): DestinationGuide | null {
  return GUIDE_INDEX.get(code.toUpperCase()) ?? null;
}

export function listGuides(): DestinationGuide[] {
  return [...GUIDES];
}

export function searchGuides(query: string): DestinationGuide[] {
  const q = query.toLowerCase();
  return GUIDES.filter(
    (g) =>
      g.code.toLowerCase().includes(q) ||
      g.city.toLowerCase().includes(q) ||
      g.country.toLowerCase().includes(q) ||
      g.region.includes(q),
  );
}
