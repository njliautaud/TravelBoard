"use client";

/**
 * SearchView — unified flight search with airport autocomplete, results list,
 * calendar heatmap, and "watch this route" integration.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import PriceHistoryChart from "./PriceHistoryChart";
import { getDemoMode, DEMO_SEARCH_RESULTS } from "@/lib/demoData";

// ---------------------------------------------------------------------------
// Types matching our API responses
// ---------------------------------------------------------------------------

interface SearchHit {
  kind: string;
  score: number;
  label: string;
  sublabel: string;
  code: string;
  lat: number;
  lon: number;
}

interface FlightResult {
  id: string;
  origin: string;
  destination: string;
  flyToCode: string;
  month: number;
  outboundDate: string | null;
  returnDate: string | null;
  price: number;
  currency: string;
  airline: string | null;
  source: string | null;
  dealScore: number | null;
  tier: string | null;
  lastSeen: string;
}

interface CalendarPoint {
  date: string;
  price: number;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtPrice(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// Calendar heatmap sub-component
// ---------------------------------------------------------------------------

function CalendarHeatmap({ points }: { points: CalendarPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic">
        No departure date data cached for this route yet.
      </p>
    );
  }

  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const range = Math.max(1, hi - lo);

  // Organize into month grids
  const byMonth = new Map<string, CalendarPoint[]>();
  for (const p of points) {
    const monthKey = p.date.slice(0, 7); // yyyy-mm
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(p);
  }

  // Color scale: green (cheap) to amber (mid) to red (expensive)
  function cellColor(price: number): string {
    const t = (price - lo) / range;
    if (t < 0.33) return "bg-emerald-600/60";
    if (t < 0.66) return "bg-amber-500/50";
    return "bg-rose-500/40";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        <span className="font-medium">Price by departure date</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-600/60" />cheap
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-500/50" />mid
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-rose-500/40" />high
        </span>
      </div>
      <div className="flex flex-wrap gap-4">
        {[...byMonth.entries()].map(([monthKey, mPoints]) => {
          const [y, m] = monthKey.split("-").map(Number) as [number, number];
          const monthLabel = `${MONTHS[m - 1]} ${y}`;
          return (
            <div key={monthKey} className="min-w-0">
              <div className="text-[10px] text-slate-400 mb-1 font-medium">
                {monthLabel}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {mPoints.map((p) => {
                  const day = parseInt(p.date.slice(8, 10), 10);
                  return (
                    <div
                      key={p.date}
                      className={`w-5 h-5 rounded-sm flex items-center justify-center text-[8px] font-medium text-white ${cellColor(p.price)}`}
                      title={`${fmtDate(p.date)}: ${fmtPrice(p.price)}`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-600 italic">
        Cheapest: {fmtPrice(lo)} -- Most expensive: {fmtPrice(hi)} -- Observed
        prices from fare scans
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SearchView
// ---------------------------------------------------------------------------

interface SearchViewProps {
  defaultOrigin?: string;
}

export default function SearchView({ defaultOrigin = "MCO" }: SearchViewProps) {
  // Form state
  const [originInput, setOriginInput] = useState(defaultOrigin);
  const [destInput, setDestInput] = useState("");
  const [month, setMonth] = useState<number | null>(null);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<SearchHit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);

  // Results
  const [results, setResults] = useState<FlightResult[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calendar
  const [calendar, setCalendar] = useState<CalendarPoint[] | null>(null);

  // Price history for expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<CalendarPoint[]>([]);

  // Watch creation feedback
  const [watchMsg, setWatchMsg] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Destination autocomplete
  useEffect(() => {
    const q = destInput.trim();
    if (q.length < 2 || selectedDest) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8&mode=places`)
        .then((r) => r.json())
        .then((d) => {
          setSuggestions(d.hits ?? []);
          setShowSuggestions(true);
        })
        .catch(() => setSuggestions([]));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [destInput, selectedDest]);

  // Search flights
  const runSearch = useCallback(() => {
    setLoading(true);
    setError(null);
    setCalendar(null);

    // Demo mode: use sample data
    if (getDemoMode()) {
      let filtered = DEMO_SEARCH_RESULTS as FlightResult[];
      const q = destInput.trim().toLowerCase();
      if (selectedDest) {
        filtered = filtered.filter((r) => r.flyToCode === selectedDest || r.destination === selectedDest);
      } else if (q) {
        filtered = filtered.filter((r) =>
          r.destination.toLowerCase().includes(q) ||
          r.flyToCode.toLowerCase().includes(q)
        );
      }
      if (month != null) {
        filtered = filtered.filter((r) => r.month === month);
      }
      setResults(filtered);
      setTotalMatched(filtered.length);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ mode: "flights", limit: "50" });
    if (originInput.trim()) params.set("origin", originInput.trim().toUpperCase());
    if (selectedDest) params.set("destination", selectedDest);
    else if (destInput.trim()) params.set("q", destInput.trim());
    if (month != null) params.set("month", String(month));

    fetch(`/api/search?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setResults(d.results ?? []);
        setTotalMatched(d.totalMatched ?? 0);
        setLoading(false);
      })
      .catch(() => {
        // Fall back to demo results on API failure
        setResults(DEMO_SEARCH_RESULTS as FlightResult[]);
        setTotalMatched(DEMO_SEARCH_RESULTS.length);
        setLoading(false);
      });

    // Calendar view if we have a specific route
    const dest = selectedDest || destInput.trim().toUpperCase();
    const origin = originInput.trim().toUpperCase();
    if (dest && dest.length === 3 && origin) {
      fetch(
        `/api/search/calendar?origin=${origin}&destination=${dest}`,
      )
        .then((r) => r.json())
        .then((d) => setCalendar(d.points ?? []))
        .catch(() => setCalendar(null));
    }
  }, [originInput, destInput, selectedDest, month]);

  // Run initial search on mount
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitDest = (code: string, label: string) => {
    setSelectedDest(code);
    setDestInput(label);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  // Load price history for a route when expanding
  const loadHistory = (origin: string, dest: string) => {
    fetch(`/api/search/calendar?origin=${origin}&destination=${dest}&view=history`)
      .then((r) => r.json())
      .then((d) => setPriceHistory(d.points ?? []))
      .catch(() => setPriceHistory([]));
  };

  // Watch a route
  const addWatch = async (origin: string, destCode: string, price: number) => {
    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin,
          destinationCode: destCode,
          targetPrice: Math.round(price * 0.9), // Default target: 10% below current
        }),
      });
      if (res.ok) {
        setWatchMsg(`Watching ${origin} to ${destCode} for under ${fmtPrice(price * 0.9)}`);
        setTimeout(() => setWatchMsg(null), 3000);
      } else {
        const d = await res.json();
        setWatchMsg(d.error ?? "Could not create watch");
        setTimeout(() => setWatchMsg(null), 3000);
      }
    } catch {
      setWatchMsg("Failed to create watch");
      setTimeout(() => setWatchMsg(null), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap gap-2 p-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur"
      >
        {/* Origin */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">
            From
          </label>
          <input
            value={originInput}
            onChange={(e) => setOriginInput(e.target.value)}
            className="w-20 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-200 border border-slate-700 focus:border-amber-500/50 outline-none"
            placeholder="MCO"
            maxLength={3}
          />
        </div>

        {/* Destination with autocomplete */}
        <div className="relative flex flex-col gap-0.5 flex-1 min-w-[140px]">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">
            To
          </label>
          <input
            data-testid="hero-search-input"
            value={destInput}
            onChange={(e) => {
              setDestInput(e.target.value);
              if (selectedDest) setSelectedDest(null);
            }}
            onFocus={() => {
              if (suggestions.length) setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="w-full rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-200 border border-slate-700 focus:border-amber-500/50 outline-none"
            placeholder="Anywhere -- or city / airport"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              {suggestions.map((h) => (
                <button
                  key={`${h.kind}-${h.code}`}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-800 transition flex items-baseline gap-2"
                  onMouseDown={() => commitDest(h.code, h.label)}
                >
                  <span className="text-amber-400 font-mono font-bold text-xs">
                    {h.code}
                  </span>
                  <span className="text-slate-200">{h.label}</span>
                  {h.sublabel && (
                    <span className="text-slate-500 text-xs truncate">
                      {h.sublabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Month */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">
            When
          </label>
          <select
            value={month == null ? "any" : String(month)}
            onChange={(e) =>
              setMonth(e.target.value === "any" ? null : Number(e.target.value))
            }
            className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-200 border border-slate-700 focus:border-amber-500/50 outline-none"
          >
            <option value="any">Any time</option>
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Search button */}
        <div className="flex flex-col justify-end">
          <button
            type="submit"
            className="rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-4 py-1.5 text-sm font-medium transition border border-amber-500/30"
          >
            Search
          </button>
        </div>
      </form>

      {/* Watch creation feedback */}
      {watchMsg && (
        <div className="px-3 py-1.5 text-xs bg-amber-500/10 text-amber-300 border-b border-amber-500/20">
          {watchMsg}
        </div>
      )}

      {/* Results area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            Searching...
          </div>
        )}

        {error && !loading && (
          <div className="text-red-400 text-sm py-4 text-center">
            Search failed: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Summary line */}
            <div className="text-xs text-slate-500">
              {totalMatched} result{totalMatched === 1 ? "" : "s"} found
              {selectedDest ? ` for ${selectedDest}` : ""}
            </div>

            {/* Calendar heatmap */}
            {calendar && calendar.length > 0 && (
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                <CalendarHeatmap points={calendar} />
              </div>
            )}

            {/* Results list */}
            <div className="space-y-1.5">
              {results.map((r) => {
                const isExpanded = expandedId === r.id;
                return (
                  <div
                    key={r.id}
                    className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden"
                  >
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition text-left"
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedId(null);
                        } else {
                          setExpandedId(r.id);
                          loadHistory(r.origin, r.destination);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">
                            {r.origin}
                          </span>
                          <span className="text-slate-600">-&gt;</span>
                          <span className="text-sm font-medium text-slate-200">
                            {r.flyToCode || r.destination}
                          </span>
                          {r.tier === "cheap" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                              cheap
                            </span>
                          )}
                          {r.dealScore != null && r.dealScore >= 0.2 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                              deal
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {r.outboundDate
                            ? `${fmtDate(r.outboundDate)} - ${fmtDate(r.returnDate)}`
                            : `Month ${MONTHS[r.month] ?? r.month}`}
                          {r.airline ? ` -- ${r.airline}` : ""}
                          {r.source ? ` -- ${r.source}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-amber-300">
                          {fmtPrice(r.price)}
                        </span>
                        <span className="text-slate-600 text-xs">
                          {isExpanded ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>}
                        </span>
                      </div>
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-800/50 space-y-3">
                        {/* Price history chart */}
                        {priceHistory.length >= 2 && (
                          <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 font-medium">
                              Price History
                            </div>
                            <PriceHistoryChart points={priceHistory} />
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              addWatch(
                                r.origin,
                                r.flyToCode || r.destination,
                                r.price,
                              )
                            }
                            className="text-xs px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-amber-300 transition border border-slate-700"
                          >
                            Watch this route
                          </button>
                          <span className="text-[10px] text-slate-600">
                            Last seen{" "}
                            {new Date(r.lastSeen).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {results.length === 0 && !loading && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No fares found for this search. Try different dates or a different destination.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
