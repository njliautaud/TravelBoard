"use client";

/**
 * Price Trend Badge -- inline indicator on deal cards showing price direction.
 * Shows: "Prices dropping" (green), "Prices rising" (red), "Prices stable" (blue).
 */

import { useEffect, useState } from "react";

type PriceTrend = "dropping" | "rising" | "stable";

interface TrendData {
  trend: PriceTrend;
  dataPoints: number;
  summary: string;
  recommendation: string;
  priceChange7dPct: number | null;
}

// In-memory cache
const _cache = new Map<string, TrendData | null>();
const _inflight = new Map<string, Promise<TrendData | null>>();

function useTrend(origin: string, dest: string): TrendData | null {
  const [data, setData] = useState<TrendData | null>(null);

  useEffect(() => {
    const key = `${origin}-${dest}`;
    if (_cache.has(key)) {
      setData(_cache.get(key)!);
      return;
    }

    let cancelled = false;
    const existing = _inflight.get(key);
    const promise =
      existing ??
      fetch(`/api/fares/history/${encodeURIComponent(origin)}/${encodeURIComponent(dest)}?days=30`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!d || !d.history || d.history.length < 3) {
            _cache.set(key, null);
            return null;
          }
          // Compute trend from history
          const prices = d.history.map((h: { price: number }) => h.price);
          const recent = prices.slice(-7);
          const older = prices.slice(0, Math.max(1, prices.length - 7));
          const avgRecent = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
          const avgOlder = older.reduce((a: number, b: number) => a + b, 0) / older.length;
          const pctChange = avgOlder > 0 ? Math.round(((avgRecent - avgOlder) / avgOlder) * 100) : 0;

          let trend: PriceTrend = "stable";
          if (pctChange <= -3) trend = "dropping";
          else if (pctChange >= 3) trend = "rising";

          const result: TrendData = {
            trend,
            dataPoints: prices.length,
            summary: trend === "dropping"
              ? `Prices down ${Math.abs(pctChange)}% over 7 days`
              : trend === "rising"
                ? `Prices up ${pctChange}% over 7 days`
                : "Prices holding steady",
            recommendation: trend === "dropping"
              ? "Prices are falling -- good time to watch for a bottom"
              : trend === "rising"
                ? "Prices trending up -- book soon or set an alert"
                : "Prices stable -- no rush, but deals can appear anytime",
            priceChange7dPct: pctChange,
          };
          _cache.set(key, result);
          return result;
        })
        .catch(() => {
          _cache.set(key, null);
          return null;
        })
        .finally(() => {
          _inflight.delete(key);
        });

    if (!existing) _inflight.set(key, promise);

    promise.then((r) => {
      if (!cancelled) setData(r);
    });

    return () => { cancelled = true; };
  }, [origin, dest]);

  return data;
}

const TREND_STYLES: Record<PriceTrend, { arrow: string; label: string; badge: string }> = {
  dropping: {
    arrow: "\u2193",
    label: "Prices dropping",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  rising: {
    arrow: "\u2191",
    label: "Prices rising",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  stable: {
    arrow: "\u2192",
    label: "Prices stable",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
};

/**
 * Compact inline badge for deal cards. Only renders if data available.
 */
export function PriceTrendBadge({ origin, dest }: { origin: string; dest: string }) {
  const trend = useTrend(origin, dest);
  if (!trend || trend.dataPoints < 3) return null;

  const style = TREND_STYLES[trend.trend];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}
      title={trend.summary}
    >
      <span className="font-bold">{style.arrow}</span>
      <span>{style.label}</span>
      {trend.priceChange7dPct != null && Math.abs(trend.priceChange7dPct) >= 1 && (
        <span className="font-semibold">
          {trend.priceChange7dPct > 0 ? "+" : ""}{trend.priceChange7dPct}%
        </span>
      )}
    </span>
  );
}

/**
 * Slightly larger trend line for use in detail panels.
 */
export function PriceTrendSummary({
  origin,
  dest,
  cityName,
}: {
  origin: string;
  dest: string;
  cityName?: string;
}) {
  const trend = useTrend(origin, dest);
  if (!trend || trend.dataPoints < 3) return null;

  const style = TREND_STYLES[trend.trend];

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${style.badge}`}>
      <span className="text-base font-bold">{style.arrow}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold">
          {style.label} for {cityName ?? dest}
        </div>
        <div className="text-[10px] opacity-80">{trend.recommendation}</div>
      </div>
    </div>
  );
}
