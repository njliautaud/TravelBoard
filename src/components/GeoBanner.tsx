"use client";

import { useEffect, useState } from "react";
import type { LocationItem } from "@/lib/types";

interface GeoBannerProps {
  locations: LocationItem[];
}

interface GeoInfo {
  countryName: string;
  countryCode: string | null;
}

const PROXIMITY_KM = 150;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function GeoBanner({ locations }: GeoBannerProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<GeoInfo | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setState("unavailable"),
      { timeout: 10000, maximumAge: 600000 }
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    fetch(`/api/geocode?lat=${coords.lat}&lon=${coords.lng}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const r = data.results?.[0];
        if (r?.countryName) {
          setGeo({ countryName: r.countryName, countryCode: r.countryCode });
          setState("ready");
        } else {
          setState("unavailable");
        }
      })
      .catch(() => !cancelled && setState("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [coords]);

  if (state === "unavailable") return null;

  if (state === "loading" || !geo || !coords) {
    return (
      <div className="pointer-events-none rounded-full border border-slate-700/60 bg-slate-900/80 px-4 py-1.5 text-xs text-slate-400 backdrop-blur">
        Locating you&hellip;
      </div>
    );
  }

  const wishesHere = geo.countryCode
    ? locations.filter((l) => l.countryCode === geo.countryCode).length
    : 0;

  let nearest: { label: string; km: number } | null = null;
  for (const l of locations) {
    const km = haversineKm(coords.lat, coords.lng, l.latitude, l.longitude);
    if (km <= PROXIMITY_KM && (nearest === null || km < nearest.km)) {
      nearest = { label: l.region || l.city || l.activityName, km };
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="rounded-full border border-slate-700/60 bg-slate-900/80 px-4 py-1.5 text-xs text-slate-300 backdrop-blur sm:text-sm">
        Current Country: <span className="font-semibold text-slate-100">{geo.countryName}</span>
        <span className="mx-2 text-slate-600">|</span>
        <span className="font-semibold text-amber-300">{wishesHere}</span>{" "}
        {wishesHere === 1 ? "wish" : "wishes"} logged here
      </div>
      {nearest && (
        <div className="rounded-full border border-amber-500/50 bg-amber-500/15 px-4 py-1 text-xs font-medium text-amber-200 backdrop-blur">
          You are close to {nearest.label}! ({Math.round(nearest.km)} km away)
        </div>
      )}
    </div>
  );
}
