// Lightweight, client-safe text similarity for deciding when two searches /
// wishes describe "the same thing". Used by both the image cache (so a
// reworded or translated query reuses cached results) and the duplicate-wish
// warning. A synonym layer collapses common travel terms across languages
// (e.g. Spanish "salar" and English "salt flat" both -> "saltflat").

const STOPWORDS = new Set([
  // English filler
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "for", "with",
  "near", "by", "from", "into", "around", "my", "your", "this", "that", "is",
  "it", "its", "be", "basic", "located", "location", "place", "spot", "trip",
  "visit", "see", "go", "going", "explore", "area", "tour", "where", "how",
  "best", "top", "guide",
  // generic admin / geography words — non-distinctive, so they shouldn't make
  // two different places look alike (e.g. a shared country "united states", or
  // "<X> county"). Both singular + plural (stopword filter runs pre-singularize).
  "state", "states", "county", "counties", "province", "provinces", "region",
  "regions", "district", "districts", "city", "cities", "town", "towns",
  "municipality", "republic", "national",
  // foreign articles / prepositions so "Salar de Gorbea" -> {salar, gorbea}
  "de", "del", "la", "el", "los", "las", "un", "una", "le", "les", "du", "des",
  "di", "da", "dos", "do", "der", "die",
]);

// Directional / qualifier words that DISTINGUISH otherwise-similar names:
// "North Carolina" vs "South Carolina", "New York" vs "York". If one wish has
// one of these and the other doesn't, they are different places.
const DISTINGUISHERS = new Set([
  "north", "south", "east", "west", "northern", "southern", "eastern", "western",
  "new", "old", "upper", "lower", "central",
]);

// Canonical term -> all the words/phrases (any language) that mean it.
const SYNONYM_GROUPS: Record<string, string[]> = {
  saltflat: ["salar", "salares", "salt flat", "salt flats", "salt pan", "salt pans", "salina", "salinas"],
  waterfall: ["waterfall", "waterfalls", "falls", "cascada", "cascadas", "catarata", "cataratas", "cachoeira", "wasserfall"],
  mountain: ["mountain", "mountains", "montana", "montanas", "montagne", "berg", "monte", "cerro", "nevado"],
  lake: ["lake", "lago", "lac", "laguna", "lagoon", "see"],
  beach: ["beach", "beaches", "playa", "playas", "plage", "praia", "strand"],
  desert: ["desert", "deserts", "desierto", "wuste"],
  volcano: ["volcano", "volcanoes", "volcan", "volcanes", "vulkan"],
  glacier: ["glacier", "glaciers", "glaciar", "gletscher"],
  river: ["river", "rio", "riviere", "fluss"],
  island: ["island", "islands", "isla", "islas", "ile", "ilha", "insel"],
  forest: ["forest", "bosque", "selva", "foret", "wald", "rainforest", "jungle"],
  valley: ["valley", "valle", "vallee", "tal"],
  canyon: ["canyon", "canon", "gorge", "quebrada"],
  cave: ["cave", "caves", "cueva", "grotte", "hohle", "cavern"],
  park: ["park", "parque", "parc"],
  cathedral: ["cathedral", "catedral", "cathedrale", "iglesia", "church", "kirche", "eglise"],
  castle: ["castle", "castillo", "chateau", "schloss", "burg"],
  market: ["market", "mercado", "marche", "markt", "souk"],
  bridge: ["bridge", "puente", "pont", "brucke"],
  hotspring: ["hot spring", "hot springs", "termas", "aguas termales", "onsen"],
  train: ["train", "tren", "zug", "railway", "railroad"],
};

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [];
const TOKEN_CANON: Record<string, string> = {};
for (const [canon, variants] of Object.entries(SYNONYM_GROUPS)) {
  for (const v of variants) {
    if (v.includes(" ")) {
      PHRASE_REPLACEMENTS.push([new RegExp(`\\b${v.replace(/\s+/g, "\\s+")}\\b`, "g"), ` ${canon} `]);
    } else {
      TOKEN_CANON[v] = canon;
    }
  }
}
// Apply longer phrases first ("salt flats" before "salt flat").
PHRASE_REPLACEMENTS.sort((a, b) => b[0].source.length - a[0].source.length);

function fold(s: string): string {
  // lowercase + strip combining diacritics (U+0300–U+036F) so "Gorbéa" == "gorbea".
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function canonicalize(text: string): string {
  let s = ` ${fold(text).replace(/[^a-z0-9\s]/g, " ")} `;
  for (const [re, canon] of PHRASE_REPLACEMENTS) s = s.replace(re, canon);
  return s;
}

/** Normalize -> synonym/translation map -> drop stopwords -> singularize -> set. */
export function tokenize(text: string): Set<string> {
  return new Set(
    canonicalize(text)
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
      .map((t) => TOKEN_CANON[t] ?? t)
      .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

/** Overlap coefficient of two free-text strings (0..1), forgiving of length. */
export function overlapScore(a: string, b: string): number {
  return overlap(tokenize(a), tokenize(b));
}

export interface WishLike {
  activityName: string;
  city?: string | null;
  region?: string | null;
  countryName?: string | null;
  countryCode?: string | null;
}

function locationLabel(w: WishLike): string {
  return [w.city, w.region, w.countryName].filter(Boolean).join(" ");
}

/** Activity tokens with the wish's own place words removed, so a shared
 *  country ("France") doesn't make Eiffel Tower and the Louvre look alike. */
function activityTokens(w: WishLike): Set<string> {
  const loc = tokenize(locationLabel(w));
  const out = new Set<string>();
  for (const t of tokenize(w.activityName)) if (!loc.has(t)) out.add(t);
  return out.size ? out : tokenize(w.activityName);
}

/**
 * True when two wishes are the same place + a similar activity — used to warn
 * before adding a duplicate. Country must match; activity overlap (after
 * synonym/translation folding) must clear [threshold].
 */
export function isDuplicateWish(a: WishLike, b: WishLike, threshold = 0.5): boolean {
  const sameCountry =
    a.countryCode && b.countryCode
      ? a.countryCode.toUpperCase() === b.countryCode.toUpperCase()
      : Boolean(a.countryName) && fold(a.countryName ?? "") === fold(b.countryName ?? "");
  if (!sameCountry) return false;
  const ta = activityTokens(a);
  const tb = activityTokens(b);
  // A differing directional/qualifier word means distinct places even if the
  // rest overlaps ("north carolina" vs "south carolina").
  for (const t of ta) if (DISTINGUISHERS.has(t) && !tb.has(t)) return false;
  for (const t of tb) if (DISTINGUISHERS.has(t) && !ta.has(t)) return false;
  return overlap(ta, tb) >= threshold;
}
