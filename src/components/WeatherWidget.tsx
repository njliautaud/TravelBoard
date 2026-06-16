"use client";

/**
 * WeatherWidget — simple weather display for a destination.
 * Uses Open-Meteo (free, no key) for current conditions and seasonal data.
 */

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  icon: string;
  isDay: boolean;
}

interface Props {
  /** Destination name for display */
  destination: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lon: number;
  /** Optional: best time to visit hint */
  bestMonths?: string;
}

// WMO weather code -> condition label + icon
const WMO_CODES: Record<number, { label: string; dayIcon: string; nightIcon: string }> = {
  0:  { label: "Clear sky",         dayIcon: "sun",         nightIcon: "moon" },
  1:  { label: "Mainly clear",      dayIcon: "sun",         nightIcon: "moon" },
  2:  { label: "Partly cloudy",     dayIcon: "cloud-sun",   nightIcon: "cloud-moon" },
  3:  { label: "Overcast",          dayIcon: "cloud",       nightIcon: "cloud" },
  45: { label: "Fog",               dayIcon: "fog",         nightIcon: "fog" },
  48: { label: "Rime fog",          dayIcon: "fog",         nightIcon: "fog" },
  51: { label: "Light drizzle",     dayIcon: "drizzle",     nightIcon: "drizzle" },
  53: { label: "Drizzle",           dayIcon: "drizzle",     nightIcon: "drizzle" },
  55: { label: "Heavy drizzle",     dayIcon: "drizzle",     nightIcon: "drizzle" },
  61: { label: "Light rain",        dayIcon: "rain",        nightIcon: "rain" },
  63: { label: "Rain",              dayIcon: "rain",        nightIcon: "rain" },
  65: { label: "Heavy rain",        dayIcon: "rain",        nightIcon: "rain" },
  71: { label: "Light snow",        dayIcon: "snow",        nightIcon: "snow" },
  73: { label: "Snow",              dayIcon: "snow",        nightIcon: "snow" },
  75: { label: "Heavy snow",        dayIcon: "snow",        nightIcon: "snow" },
  80: { label: "Rain showers",      dayIcon: "rain",        nightIcon: "rain" },
  81: { label: "Mod. rain showers", dayIcon: "rain",        nightIcon: "rain" },
  82: { label: "Heavy showers",     dayIcon: "rain",        nightIcon: "rain" },
  85: { label: "Snow showers",      dayIcon: "snow",        nightIcon: "snow" },
  86: { label: "Heavy snow showers",dayIcon: "snow",        nightIcon: "snow" },
  95: { label: "Thunderstorm",      dayIcon: "storm",       nightIcon: "storm" },
  96: { label: "T-storm w/ hail",   dayIcon: "storm",       nightIcon: "storm" },
  99: { label: "Heavy t-storm",     dayIcon: "storm",       nightIcon: "storm" },
};

function decodeWMO(code: number, isDay: boolean): { label: string; icon: string } {
  const entry = WMO_CODES[code] ?? { label: "Unknown", dayIcon: "cloud", nightIcon: "cloud" };
  return { label: entry.label, icon: isDay ? entry.dayIcon : entry.nightIcon };
}

// Icon SVGs (simple, inline)
const ICON_MAP: Record<string, React.ReactNode> = {
  sun: (
    <svg className="h-10 w-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07-1.41 1.41M8.34 15.66l-1.41 1.41m12.14 0-1.41-1.41M8.34 8.34 6.93 6.93" />
    </svg>
  ),
  moon: (
    <svg className="h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  cloud: (
    <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M6.5 19a4.5 4.5 0 0 1-.42-8.98A7 7 0 0 1 19.5 12.5 4 4 0 0 1 18 19H6.5z" />
    </svg>
  ),
  "cloud-sun": (
    <svg className="h-10 w-10 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M6.5 19a4.5 4.5 0 0 1-.42-8.98A7 7 0 0 1 19.5 12.5 4 4 0 0 1 18 19H6.5z" />
      <circle cx="18" cy="6" r="3" />
    </svg>
  ),
  "cloud-moon": (
    <svg className="h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M6.5 19a4.5 4.5 0 0 1-.42-8.98A7 7 0 0 1 19.5 12.5 4 4 0 0 1 18 19H6.5z" />
      <path d="M20 4.79A4 4 0 0 1 15.21 2 3 3 0 0 0 20 4.79z" />
    </svg>
  ),
  rain: (
    <svg className="h-10 w-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M6.5 17a4.5 4.5 0 0 1-.42-8.98A7 7 0 0 1 19.5 10.5 4 4 0 0 1 18 17H6.5z" />
      <path d="M8 19v2m4-2v2m4-2v2" />
    </svg>
  ),
  drizzle: (
    <svg className="h-10 w-10 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M6.5 17a4.5 4.5 0 0 1-.42-8.98A7 7 0 0 1 19.5 10.5 4 4 0 0 1 18 17H6.5z" />
      <path d="M10 19v1m4-2v1" strokeDasharray="2 2" />
    </svg>
  ),
  snow: (
    <svg className="h-10 w-10 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M6.5 17a4.5 4.5 0 0 1-.42-8.98A7 7 0 0 1 19.5 10.5 4 4 0 0 1 18 17H6.5z" />
      <path d="M8 20h.01M12 20h.01M16 20h.01" strokeLinecap="round" />
    </svg>
  ),
  storm: (
    <svg className="h-10 w-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M6.5 17a4.5 4.5 0 0 1-.42-8.98A7 7 0 0 1 19.5 10.5 4 4 0 0 1 18 17H6.5z" />
      <path d="M13 17l-2 5 4-3-2 5" />
    </svg>
  ),
  fog: (
    <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M4 14h16M4 18h12M6 10h12" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WeatherWidget({ destination, lat, lon, bestMonths }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        setLoading(true);
        setError(null);

        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(lat));
        url.searchParams.set("longitude", String(lon));
        url.searchParams.set(
          "current",
          "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day",
        );
        url.searchParams.set("temperature_unit", "fahrenheit");
        url.searchParams.set("wind_speed_unit", "mph");

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Weather API error");

        const data = await res.json();
        const c = data.current;
        const isDay = c.is_day === 1;
        const decoded = decodeWMO(c.weather_code, isDay);

        setWeather({
          temperature: Math.round(c.temperature_2m),
          feelsLike: Math.round(c.apparent_temperature),
          humidity: c.relative_humidity_2m,
          windSpeed: Math.round(c.wind_speed_10m),
          condition: decoded.label,
          icon: decoded.icon,
          isDay,
        });
      } catch {
        setError("Unable to load weather");
      } finally {
        setLoading(false);
      }
    }

    void fetchWeather();
  }, [lat, lon]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <p className="text-sm text-slate-500">Loading weather...</p>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <p className="text-sm text-slate-500">{error ?? "No weather data"}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-amber-400">{destination}</h3>
          <p className="text-2xl font-light text-slate-100">{weather.temperature}°F</p>
          <p className="text-sm text-slate-400">{weather.condition}</p>
        </div>
        <div className="flex-shrink-0">
          {ICON_MAP[weather.icon] ?? ICON_MAP.cloud}
        </div>
      </div>

      {/* Details row */}
      <div className="grid grid-cols-3 gap-3 border-t border-slate-800 pt-3">
        <div>
          <p className="text-xs text-slate-500">Feels like</p>
          <p className="text-sm font-medium text-slate-300">{weather.feelsLike}°F</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Humidity</p>
          <p className="text-sm font-medium text-slate-300">{weather.humidity}%</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Wind</p>
          <p className="text-sm font-medium text-slate-300">{weather.windSpeed} mph</p>
        </div>
      </div>

      {/* Best time to visit */}
      {bestMonths && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-500">Best time to visit</p>
          <p className="text-sm text-amber-400/80">{bestMonths}</p>
        </div>
      )}
    </div>
  );
}
