import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";


/**
 * GET /api/deals/countries
 * Returns deal data grouped by country (destination airport country code).
 * Used by the map to color countries by deal quality.
 */
export async function GET() {
  try {
    // Get all cached fares, grouped by flyToCode — we need the cheapest per destination country
    // Filter out stale entries older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fares = await prisma.fareCache.findMany({
      where: { dealScore: { gte: 0.05 }, lastSeen: { gte: sevenDaysAgo } },
      orderBy: { price: "asc" },
      select: {
        flyToCode: true,
        destination: true,
        price: true,
        dealScore: true,
        tier: true,
        origin: true,
      },
    });

    // We need to map IATA airport codes to country ISO-3 codes
    // Import findAirport from core to get country info
    const { findAirport } = await import("@travelboard/core");

    // Group by country code (ISO alpha-2 from airport data → alpha-3 for map polygons)
    const { alpha2ToAlpha3 } = await import("@/lib/countryCodes");

    const countryMap = new Map<
      string,
      { countryCode: string; cheapestPrice: number; tier: string; bestDealScore: number }
    >();

    for (const fare of fares) {
      const airport = findAirport(fare.flyToCode);
      if (!airport) continue;

      // Get the 2-letter country code from the airport, convert to 3-letter for map
      const cc2 = getCountryCode2(airport.country);
      const cc3 = cc2 ? alpha2ToAlpha3(cc2) : null;
      if (!cc3) continue;

      const price = Number(fare.price);
      const existing = countryMap.get(cc3);
      if (!existing || price < existing.cheapestPrice) {
        countryMap.set(cc3, {
          countryCode: cc3,
          cheapestPrice: price,
          tier: fare.tier ?? "fair",
          bestDealScore: fare.dealScore ?? 0,
        });
      }
    }

    const deals = [...countryMap.values()];
    return NextResponse.json({ deals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Simple country name → ISO alpha-2 lookup for common countries. */
function getCountryCode2(countryName: string): string | null {
  const map: Record<string, string> = {
    "USA": "US", "United States": "US", "US": "US",
    "Canada": "CA", "Mexico": "MX", "Brazil": "BR", "Argentina": "AR",
    "UK": "GB", "United Kingdom": "GB", "France": "FR", "Germany": "DE",
    "Spain": "ES", "Italy": "IT", "Netherlands": "NL", "Switzerland": "CH",
    "Turkey": "TR", "UAE": "AE", "Qatar": "QA",
    "Japan": "JP", "South Korea": "KR", "China": "CN", "Singapore": "SG",
    "Australia": "AU", "New Zealand": "NZ",
    "Thailand": "TH", "Indonesia": "ID", "Malaysia": "MY", "Philippines": "PH",
    "India": "IN", "Pakistan": "PK",
    "Egypt": "EG", "South Africa": "ZA", "Kenya": "KE", "Morocco": "MA",
    "Colombia": "CO", "Peru": "PE", "Chile": "CL", "Ecuador": "EC",
    "Costa Rica": "CR", "Panama": "PA", "Jamaica": "JM",
    "Dominican Republic": "DO", "Cuba": "CU", "Puerto Rico": "PR",
    "Iceland": "IS", "Norway": "NO", "Sweden": "SE", "Denmark": "DK",
    "Finland": "FI", "Ireland": "IE", "Portugal": "PT", "Greece": "GR",
    "Austria": "AT", "Belgium": "BE", "Czech Republic": "CZ", "Czechia": "CZ",
    "Poland": "PL", "Hungary": "HU", "Romania": "RO", "Croatia": "HR",
    "Bulgaria": "BG", "Serbia": "RS",
    "Israel": "IL", "Jordan": "JO", "Lebanon": "LB", "Oman": "OM",
    "Saudi Arabia": "SA", "Kuwait": "KW", "Bahrain": "BH",
    "Vietnam": "VN", "Cambodia": "KH", "Myanmar": "MM", "Laos": "LA",
    "Taiwan": "TW", "Hong Kong": "HK", "Macau": "MO",
    "Russia": "RU", "Ukraine": "UA", "Georgia": "GE", "Armenia": "AM",
    "Sri Lanka": "LK", "Nepal": "NP", "Bangladesh": "BD",
    "Nigeria": "NG", "Ghana": "GH", "Ethiopia": "ET", "Tanzania": "TZ",
    "Fiji": "FJ", "Maldives": "MV", "Mauritius": "MU", "Seychelles": "SC",
    "Belize": "BZ", "Guatemala": "GT", "Honduras": "HN", "Nicaragua": "NI",
    "El Salvador": "SV", "Uruguay": "UY", "Paraguay": "PY", "Bolivia": "BO",
    "Venezuela": "VE", "Guyana": "GY", "Suriname": "SR",
    "Luxembourg": "LU", "Malta": "MT", "Cyprus": "CY", "Estonia": "EE",
    "Latvia": "LV", "Lithuania": "LT", "Slovakia": "SK", "Slovenia": "SI",
    "Bosnia and Herzegovina": "BA", "North Macedonia": "MK", "Montenegro": "ME",
    "Albania": "AL", "Moldova": "MD", "Belarus": "BY",
  };
  return map[countryName] ?? null;
}
