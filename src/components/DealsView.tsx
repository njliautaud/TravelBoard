"use client";

import { useCallback, useEffect, useState } from "react";
import { HOME_AIRPORTS, type AirportOption } from "@/lib/airports";
import { scoreDeal, type DealScoreBreakdown } from "@/lib/services/deal-scoring";
import { PriceTrendBadge } from "./PriceTrendBadge";
import { CompareDeals } from "./CompareDeals";
import { DealScoreBreakdown as DealScorePanel } from "./DealScoreBreakdown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DealItem {
  id: string;
  origin: string;
  destination: string;
  flyToCode: string;
  month: number;
  price: number;
  currency: string;
  airline: string | null;
  source: string | null;
  dealScore: number | null;
  tier: string | null;
  lastSeen: string;
  savingsPercent: number;
  outboundDate: string | null;
  returnDate: string | null;
}

interface HistoryPoint {
  price: number;
  source: string | null;
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const GRADE_COLORS: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  B: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  C: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  D: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  F: "bg-red-500/20 text-red-300 border-red-500/40",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold ${GRADE_COLORS[grade] ?? GRADE_COLORS.C}`}
    >
      {grade}
    </span>
  );
}

function DealCard({
  deal,
  onClick,
}: {
  deal: DealItem;
  onClick: () => void;
}) {
  const breakdown = scoreDeal({
    price: deal.price,
    baseline:
      deal.dealScore != null && deal.dealScore > 0
        ? Math.round(deal.price / (1 - deal.dealScore))
        : null,
    fetchedAt: deal.lastSeen,
    airline: deal.airline,
  });

  const tierColor =
    deal.tier === "cheap"
      ? "text-teal-400"
      : deal.tier === "fair"
        ? "text-amber-400"
        : "text-rose-400";

  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 text-left transition hover:border-slate-600 hover:bg-slate-800/80"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">
            {deal.destination}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {deal.flyToCode} from {deal.origin}
          </p>
        </div>
        <GradeBadge grade={breakdown.grade} />
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-xl font-bold ${tierColor}`}>
          ${deal.price}
        </span>
        {deal.savingsPercent > 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            -{deal.savingsPercent}%
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {deal.airline && (
          <span className="rounded-md bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-300">
            {deal.airline}
          </span>
        )}
        {deal.source && (
          <span className="rounded-md bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-300">
            {deal.source}
          </span>
        )}
        <PriceTrendBadge origin={deal.origin} dest={deal.flyToCode} />
      </div>

      <p className="mt-2 text-[11px] text-slate-500">{breakdown.summary}</p>
    </button>
  );
}

function PriceHistoryChart({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-slate-500">
        Not enough data for price history
      </div>
    );
  }

  const prices = points.map((p) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const w = 320;
  const h = 100;
  const pad = 4;

  const pathPoints = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((p.price - minP) / range) * (h - 2 * pad);
    return `${x},${y}`;
  });

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pad},${h - pad} ${pathPoints.join(" ")} ${w - pad},${h - pad}`}
          fill="url(#price-fill)"
        />
        <polyline
          points={pathPoints.join(" ")}
          fill="none"
          stroke="#2dd4bf"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>${minP}</span>
        <span>${maxP}</span>
      </div>
    </div>
  );
}

function DealDetail({
  deal,
  history,
  onClose,
}: {
  deal: DealItem;
  history: HistoryPoint[];
  onClose: () => void;
}) {
  const breakdown = scoreDeal({
    price: deal.price,
    baseline:
      deal.dealScore != null && deal.dealScore > 0
        ? Math.round(deal.price / (1 - deal.dealScore))
        : null,
    fetchedAt: deal.lastSeen,
    airline: deal.airline,
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-950 p-5">
      <button
        onClick={onClose}
        className="mb-4 self-start rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      >
        &larr; Back to deals
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{deal.destination}</h2>
          <p className="text-sm text-slate-400">
            {deal.flyToCode} from {deal.origin}
          </p>
        </div>
        <GradeBadge grade={breakdown.grade} />
      </div>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-3xl font-bold text-teal-400">${deal.price}</span>
        {deal.savingsPercent > 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
            Save {deal.savingsPercent}%
          </span>
        )}
      </div>

      {/* Score factors (inline) */}
      <div className="mt-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Score Breakdown
        </h3>
        <div className="space-y-2">
          {breakdown.factors.map((f) => (
            <div key={f.name} className="flex items-center gap-3">
              <div className="w-24 text-xs text-slate-400">{f.label}</div>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${Math.round(f.value * 100)}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right text-[11px] text-slate-400">
                {f.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API-driven score breakdown (if available) */}
      <div className="mt-4">
        <DealScorePanel origin={deal.origin} dest={deal.flyToCode} />
      </div>

      {/* Price history */}
      <div className="mt-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Price History (30 days)
        </h3>
        <PriceHistoryChart points={history} />
      </div>

      {/* Meta */}
      <div className="mt-6 space-y-1 text-xs text-slate-500">
        {deal.airline && <p>Airline: {deal.airline}</p>}
        {deal.source && <p>Source: {deal.source}</p>}
        <p>Last seen: {new Date(deal.lastSeen).toLocaleDateString()}</p>
        <p className="mt-2 italic">{breakdown.summary}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DealsView() {
  const [origin, setOrigin] = useState<string>("");
  const [month, setMonth] = useState<number | null>(null);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealItem | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  // Load user settings to get default origin
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const airports: string[] = data?.settings?.homeAirports ?? [];
        if (airports.length > 0 && !origin) {
          setOrigin(airports[0]!);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDeals = useCallback(async () => {
    if (!origin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ origin, limit: "50" });
      const res = await fetch(`/api/fares/top-deals?${params}`);
      const data = await res.json();
      let items: DealItem[] = data.deals ?? [];
      if (month != null) {
        items = items.filter((d) => d.month === month);
      }
      setDeals(items);
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [origin, month]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const openDetail = useCallback(
    async (deal: DealItem) => {
      setSelectedDeal(deal);
      try {
        const res = await fetch(
          `/api/fares/history/${encodeURIComponent(deal.origin)}/${encodeURIComponent(deal.flyToCode)}?days=30`,
        );
        const data = await res.json();
        setHistory(data.history ?? []);
      } catch {
        setHistory([]);
      }
    },
    [],
  );

  // Detail view
  if (selectedDeal) {
    return (
      <DealDetail
        deal={selectedDeal}
        history={history}
        onClose={() => setSelectedDeal(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-amber-400"
          >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <h1 className="text-lg font-bold text-slate-100">Deals</h1>
        </div>

        {/* Origin selector */}
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
        >
          <option value="">Select origin</option>
          {HOME_AIRPORTS.map((a: AirportOption) => (
            <option key={a.iata} value={a.iata}>
              {a.iata} — {a.city}
            </option>
          ))}
        </select>

        {/* Month filter */}
        <select
          value={month ?? ""}
          onChange={(e) =>
            setMonth(e.target.value ? parseInt(e.target.value, 10) : null)
          }
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
        >
          <option value="">All months</option>
          {MONTHS.map((m, i) => (
            <option key={i} value={i}>
              {m}
            </option>
          ))}
        </select>

        {deals.length >= 2 && (
          <button
            onClick={() => setShowCompare(true)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-amber-500/40 hover:text-amber-300"
          >
            Compare
          </button>
        )}

        {loading && (
          <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-amber-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {!origin ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-xs text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/80">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-amber-400"
                >
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-slate-100">
                Find the best flight deals
              </h2>
              <p className="mt-1.5 text-sm text-slate-400">
                Select a home airport above to see deals from that city.
              </p>
            </div>
          </div>
        ) : deals.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-500">
              No deals found. Try warming the cache or selecting a different origin.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onClick={() => openDetail(deal)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Compare modal */}
      {showCompare && (
        <CompareDeals
          origin={origin}
          month={month ?? new Date().getMonth()}
          availableCodes={deals.map((d) => ({ code: d.flyToCode, city: d.destination }))}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}
