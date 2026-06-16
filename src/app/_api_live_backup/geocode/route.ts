import { NextRequest, NextResponse } from "next/server";
import { alpha2ToAlpha3 } from "@/lib/countryCodes";
import type { GeocodeResult } from "@/lib/types";


const NOMINATIM_HEADERS = {
  "User-Agent": "TravelBoard/0.1 (personal travel journal; local dev)",
  "Accept-Language": "en",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toResult(item: any): GeocodeResult {
  const addr = item.address ?? {};
  return {
    displayName: item.display_name ?? "",
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    countryCode: alpha2ToAlpha3(addr.country_code),
    countryName: addr.country ?? null,
    region: addr.state ?? addr.region ?? addr.province ?? null,
    city: addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county ?? null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  try {
    if (q) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: NOMINATIM_HEADERS });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      const data = await res.json();
      return NextResponse.json({ results: (data as any[]).map(toResult) });
    }
    if (lat && lon) {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
      const res = await fetch(url, { headers: NOMINATIM_HEADERS });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      const data = await res.json();
      if (data?.error) return NextResponse.json({ results: [] });
      return NextResponse.json({ results: [toResult(data)] });
    }
    return NextResponse.json({ error: "Provide ?q= for search or ?lat=&lon= for reverse" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `Geocoding failed: ${String(e)}` }, { status: 502 });
  }
}
