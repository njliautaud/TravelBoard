import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { createEntry } from "@/lib/services/journal";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Vibe detection keywords — maps content keywords to travel vibes
// ---------------------------------------------------------------------------

const VIBE_KEYWORDS: Record<string, string[]> = {
  beach: [
    "beach", "ocean", "surf", "sand", "tropical", "island", "coast", "seaside",
    "palm", "snorkel", "dive", "reef", "waves", "tide", "shore", "sunbathe",
    "bikini", "boardwalk", "pier", "lagoon", "cove",
  ],
  adventure: [
    "adventure", "hiking", "trek", "climb", "mountain", "summit", "canyon",
    "safari", "expedition", "explore", "wilderness", "rafting", "kayak",
    "zipline", "bungee", "skydive", "paraglide", "camping", "backpack",
  ],
  city: [
    "city", "skyline", "downtown", "urban", "metro", "skyscraper", "museum",
    "gallery", "architecture", "shopping", "mall", "street", "neighborhood",
    "district", "subway", "taxi", "rooftop",
  ],
  culture: [
    "culture", "temple", "shrine", "mosque", "church", "cathedral", "palace",
    "castle", "ruins", "ancient", "heritage", "traditional", "festival",
    "ceremony", "art", "history", "historical", "monument", "unesco",
  ],
  food: [
    "food", "cuisine", "restaurant", "eat", "dinner", "lunch", "street food",
    "market", "cafe", "coffee", "wine", "cocktail", "bar", "brunch",
    "foodie", "chef", "tasting", "sushi", "pasta", "ramen", "taco",
    "bakery", "michelin",
  ],
  nightlife: [
    "nightlife", "club", "party", "dance", "dj", "bar", "lounge", "pub",
    "live music", "concert", "festival", "nightclub", "rooftop bar",
    "happy hour", "karaoke",
  ],
  nature: [
    "nature", "forest", "waterfall", "lake", "river", "garden", "park",
    "volcano", "glacier", "aurora", "northern lights", "sunset", "sunrise",
    "wildlife", "birds", "jungle", "rainforest", "flower",
  ],
  luxury: [
    "luxury", "spa", "resort", "villa", "penthouse", "five star", "5 star",
    "boutique hotel", "infinity pool", "butler", "champagne", "caviar",
    "first class", "business class", "overwater",
  ],
  romantic: [
    "romantic", "honeymoon", "couples", "anniversary", "proposal", "love",
    "gondola", "candlelight", "rose", "valentine",
  ],
};

// ---------------------------------------------------------------------------
// Destination / location extraction heuristics
// ---------------------------------------------------------------------------

/** Common travel destination names for extraction. */
const DESTINATION_PATTERNS = [
  // Countries
  "Japan", "Thailand", "Italy", "France", "Spain", "Greece", "Portugal",
  "Mexico", "Colombia", "Peru", "Brazil", "Argentina", "Costa Rica",
  "Iceland", "Norway", "Switzerland", "Croatia", "Turkey", "Morocco",
  "Egypt", "Kenya", "South Africa", "Bali", "Indonesia", "Vietnam",
  "Philippines", "Malaysia", "Singapore", "Australia", "New Zealand",
  "Maldives", "Fiji", "Dubai", "India", "Nepal", "Sri Lanka",
  // Popular cities
  "Paris", "London", "Rome", "Barcelona", "Amsterdam", "Berlin", "Prague",
  "Budapest", "Vienna", "Lisbon", "Athens", "Istanbul", "Marrakech",
  "Tokyo", "Kyoto", "Seoul", "Bangkok", "Bali", "Hanoi", "Saigon",
  "Hong Kong", "Shanghai", "Beijing", "Mumbai", "Delhi", "Sydney",
  "Melbourne", "Auckland", "Cape Town", "Nairobi", "Cairo",
  "New York", "Los Angeles", "Miami", "San Francisco", "Chicago",
  "Nashville", "Austin", "Cancun", "Tulum", "Playa del Carmen",
  "Havana", "Cartagena", "Medellin", "Lima", "Cusco", "Machu Picchu",
  "Buenos Aires", "Rio de Janeiro", "Sao Paulo",
  "Santorini", "Mykonos", "Amalfi", "Cinque Terre", "Positano",
  "Capri", "Dubrovnik", "Split", "Hvar",
];

function extractDestinations(text: string): string[] {
  const lower = text.toLowerCase();
  return DESTINATION_PATTERNS.filter((d) =>
    lower.includes(d.toLowerCase())
  );
}

function detectVibes(text: string): string[] {
  const lower = text.toLowerCase();
  const detected: string[] = [];

  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS)) {
    const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
    // Need at least 2 keyword hits (or 1 for short texts)
    if (matchCount >= 2 || (matchCount >= 1 && text.length < 200)) {
      detected.push(vibe);
    }
  }

  return detected;
}

// ---------------------------------------------------------------------------
// URL metadata fetching (best-effort, no heavy dependencies)
// ---------------------------------------------------------------------------

interface UrlMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const result: UrlMetadata = { title: null, description: null, image: null, siteName: null };

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TravelBoard/1.0)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return result;

    const html = await res.text();
    // Extract OpenGraph and meta tags with regex (no DOM parser needed)
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ??
                    html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/);
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/) ??
                   html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/);
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/) ??
                    html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/);
    const ogSite = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]*)"/) ??
                   html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:site_name"/);
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);

    result.title = ogTitle?.[1] ?? titleTag?.[1] ?? null;
    result.description = ogDesc?.[1] ?? null;
    result.image = ogImage?.[1] ?? null;
    result.siteName = ogSite?.[1] ?? null;
  } catch {
    // Fetch failed — return empty metadata
  }

  return result;
}

// ---------------------------------------------------------------------------
// POST /api/journal/import
// ---------------------------------------------------------------------------

/**
 * POST /api/journal/import
 * Body: { url: string, notes?: string }
 *
 * Imports a shared URL (Instagram post, TikTok video, travel blog, etc.)
 * as a journal entry. Extracts metadata, destinations, and vibes.
 *
 * Returns: { entry, destinations, vibes, metadata }
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Validate it looks like a URL
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // 1. Fetch metadata from the URL
  const metadata = await fetchUrlMetadata(url);

  // 2. Combine all text for analysis
  const allText = [
    metadata.title,
    metadata.description,
    body.notes,
  ].filter(Boolean).join(" ");

  // 3. Extract destinations and vibes
  const destinations = extractDestinations(allText);
  const vibes = detectVibes(allText);

  // 4. Determine the source platform
  let source = "link";
  if (url.includes("instagram.com")) source = "instagram";
  else if (url.includes("tiktok.com")) source = "tiktok";
  else if (url.includes("youtube.com") || url.includes("youtu.be")) source = "youtube";
  else if (url.includes("twitter.com") || url.includes("x.com")) source = "twitter";

  // 5. Create journal entry
  const title = metadata.title
    ? metadata.title.slice(0, 120)
    : `Shared from ${source}`;

  const content = [
    metadata.description ?? "",
    body.notes ?? "",
    `\n\nSource: ${url}`,
  ].filter(Boolean).join("\n\n");

  const tags = [...vibes];
  if (source !== "link") tags.push(source);
  if (destinations.length > 0) tags.push(...destinations.slice(0, 3));

  const photos = metadata.image ? [metadata.image] : [];

  // Use first detected destination as location
  const location = destinations[0] ?? null;

  const entry = await createEntry(user.id, {
    title,
    content,
    location,
    tags,
    photos,
    mood: vibes.includes("adventure") ? "excited" :
          vibes.includes("romantic") ? "dreamy" :
          vibes.includes("beach") ? "relaxed" : undefined,
  });

  // 6. Update user's preference profile with detected vibes (best-effort)
  if (vibes.length > 0 || destinations.length > 0) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { tripStyles: true },
      });
      if (dbUser) {
        const existing: string[] = (() => {
          try { return JSON.parse(dbUser.tripStyles || "[]"); }
          catch { return []; }
        })();
        const merged = [...new Set([...existing, ...vibes])].slice(0, 20);
        await prisma.user.update({
          where: { id: user.id },
          data: { tripStyles: JSON.stringify(merged) },
        });
      }
    } catch {
      // Non-critical — don't fail the import
    }
  }

  return NextResponse.json({
    entry,
    destinations,
    vibes,
    metadata: {
      title: metadata.title,
      description: metadata.description,
      image: metadata.image,
      source,
    },
  }, { status: 201 });
}
