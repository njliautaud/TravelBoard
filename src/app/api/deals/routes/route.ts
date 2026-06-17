import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findAirport,
  INTERNATIONAL_AIRPORTS,
} from "@travelboard/core";
import { alpha2ToAlpha3 } from "@/lib/countryCodes";

/**
 * GET /api/deals/routes?origin=MCO&limit=20&country=JPN
 * Returns top deal routes with origin and destination coordinates
 * for rendering flight arc paths on the map. Includes both cash and award routes.
 *
 * When `country` (ISO-3 code) is provided, filters results to airports in that country.
 */
export async function GET(req: NextRequest) {
  const originFilter = req.nextUrl.searchParams.get("origin")?.toUpperCase();
  const countryFilter = req.nextUrl.searchParams.get("country")?.toUpperCase() ?? null;
  const limitStr = req.nextUrl.searchParams.get("limit");
  const defaultLimit = countryFilter ? 50 : 20;
  const limit = limitStr ? parseInt(limitStr, 10) : defaultLimit;

  // When filtering by country, build the set of airport IATA codes in that country.
  // We reverse-map ISO-3 → country name by scanning the ALPHA2_TO_ALPHA3 table and the airports.
  let countryAirportCodes: Set<string> | null = null;
  if (countryFilter) {
    // Collect all unique country names for airports whose country maps to this ISO-3 code
    const matchingCountryNames = new Set<string>();
    for (const airport of INTERNATIONAL_AIRPORTS) {
      const cc2 = countryNameToISO2Quick(airport.country);
      const cc3 = cc2 ? alpha2ToAlpha3(cc2) : null;
      if (cc3 === countryFilter) {
        matchingCountryNames.add(airport.country);
      }
    }
    // Now collect all airport IATA codes for those country names
    countryAirportCodes = new Set<string>();
    for (const airport of INTERNATIONAL_AIRPORTS) {
      if (matchingCountryNames.has(airport.country)) {
        countryAirportCodes.add(airport.iata);
      }
    }
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where: Record<string, unknown> = {
      dealScore: { gte: 0.15 },
      lastSeen: { gte: sevenDaysAgo },
    };
    if (originFilter) where.origin = originFilter;
    // When filtering by country, restrict flyToCode to airports in that country
    if (countryAirportCodes && countryAirportCodes.size > 0) {
      where.flyToCode = { in: [...countryAirportCodes] };
    }

    const fares = await prisma.fareCache.findMany({
      where,
      orderBy: { dealScore: "desc" },
      take: Math.min(limit, 100),
      select: {
        origin: true,
        flyToCode: true,
        destination: true,
        price: true,
        dealScore: true,
        tier: true,
      },
    });

    const cashRoutes = fares
      .map((f) => {
        const originAirport = findAirport(f.origin);
        const destAirport = findAirport(f.flyToCode);
        if (!originAirport || !destAirport) return null;

        return {
          origin: f.origin,
          destination: f.flyToCode,
          destCity: f.destination,
          price: Number(f.price),
          dealScore: f.dealScore,
          tier: f.tier,
          originLat: originAirport.lat,
          originLon: originAirport.lon,
          destLat: destAirport.lat,
          destLon: destAirport.lon,
          isAward: false,
        };
      })
      .filter(Boolean);

    // Add award routes from AwardCache (DB) instead of live API
    let awardRoutes: typeof cashRoutes = [];
    if (originFilter) {
      try {
        const now = new Date();
        const awardWhere: Record<string, unknown> = {
          origin: originFilter,
          expiresAt: { gt: now },
          homeAnchored: true,
        };
        // Filter by country airports if applicable
        if (countryAirportCodes && countryAirportCodes.size > 0) {
          awardWhere.destination = { in: [...countryAirportCodes] };
        }

        const cached = await prisma.awardCache.findMany({
          where: awardWhere,
          orderBy: { score: "desc" },
          take: 10,
        });

        awardRoutes = cached.map((row) => {
          const originAirport = findAirport(row.origin);
          return {
            origin: row.origin,
            destination: row.destination,
            destCity: row.destCity ?? row.destination,
            price: row.miles,
            dealScore: row.score != null ? Math.min(row.score / 2, 1) : null,
            tier: (row.score ?? 0) >= 1.5 ? "cheap" : (row.score ?? 0) >= 1.2 ? "fair" : "splurge",
            originLat: originAirport?.lat ?? 0,
            originLon: originAirport?.lon ?? 0,
            destLat: row.destLat ?? 0,
            destLon: row.destLon ?? 0,
            isAward: true,
          };
        });
      } catch {
        // Award cache read failed — serve cash routes only
      }
    }

    // Deduplicate by destination, keeping the one with higher dealScore
    const routeMap = new Map<string, NonNullable<(typeof cashRoutes)[number]>>();
    for (const r of [...cashRoutes, ...awardRoutes]) {
      if (!r) continue;
      const key = `${r.origin}-${r.destination}`;
      const existing = routeMap.get(key);
      if (!existing || (r.dealScore ?? 0) > (existing.dealScore ?? 0)) {
        routeMap.set(key, r);
      }
    }

    const routes = [...routeMap.values()]
      .sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))
      .slice(0, Math.min(limit, 100));

    return NextResponse.json({ routes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Quick country-name → ISO-2 lookup (replicates the map from /api/deals/countries). */
function countryNameToISO2Quick(name: string): string | null {
  const MAP: Record<string, string> = {
    "USA": "US", "United States": "US", "US": "US",
    "Canada": "CA", "Mexico": "MX", "Brazil": "BR", "Argentina": "AR",
    "UK": "GB", "United Kingdom": "GB", "France": "FR", "Germany": "DE",
    "Spain": "ES", "Italy": "IT", "Netherlands": "NL", "Switzerland": "CH",
    "Turkey": "TR", "Türkiye": "TR", "UAE": "AE", "United Arab Emirates": "AE", "Qatar": "QA",
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
    "Algeria": "DZ", "Tunisia": "TN", "Libya": "LY", "Sudan": "SD",
    "Senegal": "SN", "Ivory Coast": "CI", "Côte d'Ivoire": "CI",
    "Cameroon": "CM", "Uganda": "UG", "Rwanda": "RW", "Mozambique": "MZ",
    "Madagascar": "MG", "Zambia": "ZM", "Zimbabwe": "ZW", "Botswana": "BW",
    "Namibia": "NA", "Angola": "AO",
    "Iraq": "IQ", "Iran": "IR", "Afghanistan": "AF", "Uzbekistan": "UZ",
    "Kazakhstan": "KZ", "Azerbaijan": "AZ",
    "Mongolia": "MN", "Brunei": "BN",
    "Papua New Guinea": "PG", "Samoa": "WS", "Tonga": "TO",
    "Trinidad and Tobago": "TT", "Barbados": "BB", "Bahamas": "BS",
    "Bermuda": "BM", "Cayman Islands": "KY",
    "French Polynesia": "PF", "New Caledonia": "NC",
  };
  return MAP[name] ?? null;
}
