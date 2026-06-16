"use client";

/**
 * Phase 3 — Savings Dashboard.
 * Shows how much the user saved through price alerts, with a bar chart over time
 * and summary stats. Ported from meridian, restyled for TravelBoard dark theme.
 */

import { useEffect, useState } from "react";

interface SavingsSummary {
  totalSavings: number;
  alertsTriggered: number;
  avgSavingsPerAlert: number;
  bestDeal: { code: string; savings: number; date: string } | null;
  savingsByMonth: Array<{ month: string; savings: number; alerts: number }>;
  topDestinations: Array<{ code: string; totalSavings: number; alerts: number }>;
  watchedRoutes: number;
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

const PERIODS = [
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
] as const;

export default function SavingsDashboard({ days = 90 }: { days?: number }) {
  const [data, setData] = useState<SavingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState(days);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    fetch(`/api/savings?days=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-lg">
        <p className="text-sm text-slate-400 animate-pulse">Loading your savings...</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-lg">
        <p className="text-sm text-red-400">Could not load savings data.</p>
      </div>
    );
  }

  if (!data) return null;

  const hasSavings = data.totalSavings > 0;
  const maxMonthSavings = Math.max(1, ...data.savingsByMonth.map((m) => m.savings));

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-100">Your Savings</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setPeriod(p.days)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                period === p.days
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: fmtUsd(data.totalSavings), label: "total saved", highlight: true },
          { value: String(data.alertsTriggered), label: "alerts fired" },
          { value: fmtUsd(data.avgSavingsPerAlert), label: "avg savings each" },
          { value: String(data.watchedRoutes), label: "routes watched" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-lg"
          >
            <p className={`text-xl font-bold ${stat.highlight ? "text-amber-400" : "text-slate-100"}`}>
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Best deal banner */}
      {data.bestDeal && (
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          Best catch: <span className="font-bold">{fmtUsd(data.bestDeal.savings)}</span> saved on{" "}
          <span className="font-bold">{data.bestDeal.code}</span> ({fmtDate(data.bestDeal.date)})
        </div>
      )}

      {/* Savings-by-month chart */}
      {hasSavings && data.savingsByMonth.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-lg">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Savings by month
          </p>
          <svg
            className="w-full"
            viewBox={`0 0 ${Math.max(200, data.savingsByMonth.length * 60)} 80`}
            role="img"
            aria-label="Savings by month bar chart"
            preserveAspectRatio="xMinYMax meet"
          >
            {data.savingsByMonth.map((m, i) => {
              const bw = 40;
              const gap = 20;
              const x = i * (bw + gap) + gap / 2;
              const barH = (m.savings / maxMonthSavings) * 60;
              return (
                <g key={m.month}>
                  <rect
                    x={x}
                    y={70 - barH}
                    width={bw}
                    height={Math.max(2, barH)}
                    fill="#f59e0b"
                    rx={4}
                    opacity={0.85}
                  >
                    <title>{`${m.month}: ${fmtUsd(m.savings)} saved (${m.alerts} alert${m.alerts === 1 ? "" : "s"})`}</title>
                  </rect>
                  <text x={x + bw / 2} y={78} textAnchor="middle" fontSize="8" fill="#64748b">
                    {m.month.slice(5)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Top destinations */}
      {data.topDestinations.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-lg">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Top destinations by savings
          </p>
          <div className="space-y-2">
            {data.topDestinations.slice(0, 5).map((d) => (
              <div key={d.code} className="flex items-center gap-3">
                <span className="w-10 text-xs font-bold text-slate-300">{d.code}</span>
                <div className="relative flex-1 h-5 rounded bg-slate-800/60">
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-amber-500/30"
                    style={{ width: `${(d.totalSavings / data.totalSavings) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-400">{fmtUsd(d.totalSavings)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasSavings && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          No savings recorded yet. Set up price watches on routes you care about
          and TravelBoard will track when prices drop below your target.
        </div>
      )}
    </div>
  );
}
