import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PackCategory = "clothing" | "footwear" | "accessories" | "toiletries" | "electronics" | "documents";

interface PackItem {
  item: string;
  category: PackCategory;
  priority: "essential" | "recommended" | "optional";
  reason: string;
}

function tempF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

function generateClothingItems(tempHigh: number | null, tempLow: number | null, precip: number | null): PackItem[] {
  const items: PackItem[] = [];
  const high = tempHigh ?? 22;
  const low = tempLow ?? high - 8;

  if (high >= 30) {
    items.push({ item: "Lightweight shorts", category: "clothing", priority: "essential", reason: `Hot weather expected (${tempF(high)}F+)` });
    items.push({ item: "Breathable t-shirts", category: "clothing", priority: "essential", reason: "Stay cool in the heat" });
    items.push({ item: "Sun hat", category: "accessories", priority: "recommended", reason: "Sun protection for hot days" });
    items.push({ item: "Sunglasses", category: "accessories", priority: "essential", reason: "Strong sun expected" });
  } else if (high >= 20) {
    items.push({ item: "Light layers (t-shirts + light jacket)", category: "clothing", priority: "essential", reason: `Mild weather (${tempF(low)}-${tempF(high)}F)` });
    items.push({ item: "Long pants or jeans", category: "clothing", priority: "essential", reason: "Comfortable for daytime exploring" });
    items.push({ item: "Sunglasses", category: "accessories", priority: "recommended", reason: "Useful on sunny days" });
  } else if (high >= 10) {
    items.push({ item: "Warm layers (sweater + jacket)", category: "clothing", priority: "essential", reason: `Cool weather expected (${tempF(low)}-${tempF(high)}F)` });
    items.push({ item: "Long pants", category: "clothing", priority: "essential", reason: "Too cool for shorts most days" });
    items.push({ item: "Scarf or neck gaiter", category: "accessories", priority: "recommended", reason: "Handy when the wind picks up" });
  } else {
    items.push({ item: "Heavy winter coat", category: "clothing", priority: "essential", reason: `Cold weather (${tempF(low)}F or below)` });
    items.push({ item: "Thermal base layers", category: "clothing", priority: "essential", reason: "Stay warm under your outer layers" });
    items.push({ item: "Warm hat and gloves", category: "accessories", priority: "essential", reason: "Protect extremities from the cold" });
    items.push({ item: "Insulated pants", category: "clothing", priority: "recommended", reason: "Regular jeans may not cut it" });
    items.push({ item: "Scarf", category: "accessories", priority: "essential", reason: "Keep your neck warm" });
  }

  if (tempHigh != null && tempLow != null && tempHigh - tempLow >= 15) {
    items.push({ item: "Versatile layers you can add/remove", category: "clothing", priority: "essential", reason: `Big temperature swing (${tempF(tempLow)}-${tempF(tempHigh)}F)` });
  }

  if (precip != null && precip > 5) {
    items.push({ item: "Rain jacket or packable umbrella", category: "clothing", priority: "essential", reason: "Rain is likely during your trip" });
    items.push({ item: "Waterproof shoes or boots", category: "footwear", priority: "recommended", reason: "Keep your feet dry" });
  } else if (precip != null && precip > 1) {
    items.push({ item: "Compact umbrella", category: "accessories", priority: "recommended", reason: "Some rain possible" });
  }

  return items;
}

function generateFootwear(tempHigh: number | null, precip: number | null): PackItem[] {
  const items: PackItem[] = [];
  const high = tempHigh ?? 22;

  items.push({ item: "Comfortable walking shoes", category: "footwear", priority: "essential", reason: "You'll be doing plenty of walking" });

  if (high >= 28 && (precip == null || precip < 3)) {
    items.push({ item: "Sandals or flip-flops", category: "footwear", priority: "recommended", reason: "Great for hot days and hotel/beach" });
  }

  return items;
}

function generateEssentials(tripDays: number): PackItem[] {
  const items: PackItem[] = [
    { item: "Passport / ID", category: "documents", priority: "essential", reason: "Required for travel" },
    { item: "Phone charger", category: "electronics", priority: "essential", reason: "Keep your phone alive for maps and bookings" },
    { item: "Travel adapter (if international)", category: "electronics", priority: "essential", reason: "Different countries use different plugs" },
    { item: "Sunscreen", category: "toiletries", priority: "recommended", reason: "Protect your skin outdoors" },
    { item: "Medications (if any)", category: "toiletries", priority: "essential", reason: "Don't forget prescriptions" },
    { item: "Travel insurance documents", category: "documents", priority: "recommended", reason: "Peace of mind for unexpected events" },
  ];

  if (tripDays >= 5) {
    items.push({ item: "Laundry bag", category: "accessories", priority: "optional", reason: `${tripDays}-day trip - keeps dirty clothes separate` });
    items.push({ item: "Travel-size laundry detergent", category: "toiletries", priority: "optional", reason: "Do a quick wash mid-trip to pack lighter" });
  }

  if (tripDays <= 3) {
    items.push({ item: "Carry-on only (skip the checked bag!)", category: "accessories", priority: "optional", reason: "Short trip - you can travel light and save baggage fees" });
  }

  return items;
}

function generateTips(tempHigh: number | null, tempLow: number | null, precip: number | null, tripDays: number, isClimate: boolean): string[] {
  const tips: string[] = [];
  const high = tempHigh ?? 22;

  if (isClimate) {
    tips.push("Weather is based on historical averages - check the forecast closer to your trip for exact conditions.");
  }
  if (high >= 30) {
    tips.push("Stay hydrated - bring a refillable water bottle.");
  }
  if (tripDays >= 7) {
    tips.push("For a week-long trip, pack 4-5 outfits and plan to rewear or do laundry.");
  } else if (tripDays <= 2) {
    tips.push("Weekend trip tip: one outfit per day plus a flexible layer is usually enough.");
  }
  if (precip != null && precip > 10) {
    tips.push("Heavy rain expected - consider waterproof phone case and dry bags for electronics.");
  }
  if (tempLow != null && tempHigh != null && tempHigh - tempLow >= 15) {
    tips.push("Big temperature swing - the morning and evening will feel very different from midday. Layer up!");
  }
  tips.push("Roll your clothes instead of folding to save suitcase space.");

  return tips;
}

/**
 * GET /api/packing?lat=X&lon=Y&destination=Paris&departDate=2026-07-01&returnDate=2026-07-08
 * Returns smart packing suggestions based on weather data.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat") ?? "0");
  const lon = Number(params.get("lon") ?? "0");
  const destination = params.get("destination") ?? "destination";
  const departDate = params.get("departDate") ?? new Date().toISOString().slice(0, 10);
  const returnDate = params.get("returnDate") ?? null;

  // Trip days
  let tripDays = 3;
  if (departDate && returnDate) {
    const dep = Date.parse(`${departDate}T00:00:00Z`);
    const ret = Date.parse(`${returnDate}T00:00:00Z`);
    if (Number.isFinite(dep) && Number.isFinite(ret)) {
      tripDays = Math.max(1, Math.round((ret - dep) / 86_400_000));
    }
  }

  // Try to get weather from Open-Meteo (free, no key needed)
  let tempHighC: number | null = null;
  let tempLowC: number | null = null;
  let precipMm: number | null = null;
  let summary = "moderate";
  let isClimateNormal = true;

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`;
    const res = await fetch(weatherUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const w = await res.json();
      const daily = w.daily;
      if (daily?.temperature_2m_max?.length) {
        tempHighC = Math.max(...daily.temperature_2m_max);
        tempLowC = Math.min(...daily.temperature_2m_min);
        precipMm = daily.precipitation_sum?.reduce((a: number, b: number) => a + b, 0) / daily.precipitation_sum.length;
        isClimateNormal = false;

        if (tempHighC >= 30) summary = "hot";
        else if (tempHighC >= 20) summary = "warm and pleasant";
        else if (tempHighC >= 10) summary = "cool";
        else summary = "cold";

        if (precipMm != null && precipMm > 5) summary += " with rain";
      }
    }
  } catch {
    // Graceful fallback
    tempHighC = 22;
    tempLowC = 14;
    precipMm = 2;
  }

  const items = [
    ...generateClothingItems(tempHighC, tempLowC, precipMm),
    ...generateFootwear(tempHighC, precipMm),
    ...generateEssentials(tripDays),
  ];

  const tips = generateTips(tempHighC, tempLowC, precipMm, tripDays, isClimateNormal);

  return NextResponse.json({
    destination,
    departDate,
    returnDate,
    tripDays,
    weather: { tempHighC, tempLowC, summary, isClimateNormal },
    items,
    tips,
  });
}
