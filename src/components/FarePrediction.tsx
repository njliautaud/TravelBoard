"use client";

import { useState } from "react";

interface Prediction {
  origin: string;
  destination: string;
  trend: "dropping" | "rising" | "stable";
  confidence: "high" | "medium" | "low";
  summary: string;
  currentPrice: number | null;
  avgPrice7d: number | null;
  avgPrice30d: number | null;
  priceChange7dPct: number | null;
  bestDayOfWeek: string | null;
  volatility: number | null;
  dataPoints: number;
  recommendation: string;
  recentPrices: Array<{ date: string; price: number }>;
}

const TREND_STYLES = {
  dropping: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Dropping", arrow: "↓" },
  rising: { color: "text-red-400", bg: "bg-red-500/10", label: "Rising", arrow: "↑" },
  stable: { color: "text-slate-300", bg: "bg-slate-700/50", label: "Stable", arrow: "→" },
};

const CONFIDENCE_STYLES = {
  high: "text-emerald-400",
  medium: "text-amber-400",
  low: "text-slate-500",
};

export default function FarePrediction() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [result, setResult] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePredict() {
    if (!origin.trim() || !destination.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/fare-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: origin.trim().toUpperCase(),
          destination: destination.trim().toUpperCase(),
        }),
      });
      if (res.ok) setResult(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  // Simple sparkline SVG
  function Sparkline({ prices }: { prices: Array<{ date: string; price: number }> }) {
    if (prices.length < 2) return null;
    const values = prices.map((p) => p.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 280;
    const h = 50;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    }).join(" ");

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          points={points}
          className="text-amber-400"
        />
        {/* Dots at start and end */}
        {values.length > 0 && (
          <>
            <circle
              cx={0}
              cy={h - ((values[0]! - min) / range) * (h - 4) - 2}
              r="2"
              className="fill-slate-500"
            />
            <circle
              cx={w}
              cy={h - ((values[values.length - 1]! - min) / range) * (h - 4) - 2}
              r="2.5"
              className="fill-amber-400"
            />
          </>
        )}
      </svg>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Fare Prediction</h3>
        <p className="mb-3 text-xs text-slate-500">
          Enter a route to see if prices are likely to rise or fall based on historical data.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="From (MCO)"
            maxLength={3}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="To (LHR)"
            maxLength={3}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={handlePredict}
            disabled={loading || !origin.trim() || !destination.trim()}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Predict"}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          {/* Trend Banner */}
          <div className={`rounded-lg p-4 ${TREND_STYLES[result.trend].bg}`}>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${TREND_STYLES[result.trend].color}`}>
                {TREND_STYLES[result.trend].arrow}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${TREND_STYLES[result.trend].color}`}>
                    {TREND_STYLES[result.trend].label}
                  </span>
                  <span className={`text-xs ${CONFIDENCE_STYLES[result.confidence]}`}>
                    ({result.confidence} confidence)
                  </span>
                </div>
                <p className="text-sm text-slate-300">{result.summary}</p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {result.currentPrice != null && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                <span className="text-[10px] text-slate-500 uppercase">Current</span>
                <p className="text-lg font-bold text-slate-100">${result.currentPrice}</p>
              </div>
            )}
            {result.avgPrice7d != null && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                <span className="text-[10px] text-slate-500 uppercase">7-day avg</span>
                <p className="text-lg font-bold text-slate-100">${result.avgPrice7d}</p>
              </div>
            )}
            {result.avgPrice30d != null && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                <span className="text-[10px] text-slate-500 uppercase">30-day avg</span>
                <p className="text-lg font-bold text-slate-100">${result.avgPrice30d}</p>
              </div>
            )}
            {result.priceChange7dPct != null && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                <span className="text-[10px] text-slate-500 uppercase">7d change</span>
                <p className={`text-lg font-bold ${result.priceChange7dPct < 0 ? "text-emerald-400" : result.priceChange7dPct > 0 ? "text-red-400" : "text-slate-300"}`}>
                  {result.priceChange7dPct > 0 ? "+" : ""}{result.priceChange7dPct}%
                </p>
              </div>
            )}
          </div>

          {/* Sparkline */}
          {result.recentPrices.length >= 2 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">Price trend (last 30 days)</span>
                <span className="text-xs text-slate-500">{result.dataPoints} data points</span>
              </div>
              <Sparkline prices={result.recentPrices} />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>{result.recentPrices[0]?.date}</span>
                <span>{result.recentPrices[result.recentPrices.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Extra info */}
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            {result.bestDayOfWeek && (
              <span>Cheapest day: <span className="text-amber-400">{result.bestDayOfWeek}</span></span>
            )}
            {result.volatility != null && (
              <span>Volatility: <span className="text-slate-300">{result.volatility}%</span></span>
            )}
          </div>

          {/* Recommendation */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-sm text-amber-200">{result.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
