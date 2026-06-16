"use client";

/**
 * Side-by-side deal comparison.
 * Select 2-4 destinations and compare price, trip length, distance, deal quality.
 */

import { useCallback, useEffect, useState } from "react";

interface ComparedDeal {
  code: string;
  city: string | null;
  country: string | null;
  price: number | null;
  baseline: number | null;
  dealScore: number | null;
  departDate: string | null;
  returnDate: string | null;
  tripDays: number | null;
  transfers: number | null;
  durationMin: number | null;
  deepLink: string | null;
  distance: number | null;
  missing?: boolean;
}

interface CompareResult {
  origin: string;
  month: number;
  deals: ComparedDeal[];
  cheapest: string | null;
  bestDeal: string | null;
  count: number;
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtDuration(mins: number | null): string {
  if (mins == null) return "\u2014";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function dealScoreLabel(score: number | null): { text: string; cls: string } {
  if (score == null) return { text: "\u2014", cls: "" };
  if (score >= 0.25) return { text: `${Math.round(score * 100)}% off`, cls: "text-emerald-400" };
  if (score >= 0.10) return { text: `${Math.round(score * 100)}% off`, cls: "text-teal-400" };
  if (score >= 0) return { text: "fair", cls: "text-amber-400" };
  return { text: "above avg", cls: "text-slate-400" };
}

export function CompareDeals({
  origin,
  month,
  availableCodes,
  onClose,
}: {
  origin: string;
  month: number;
  availableCodes: Array<{ code: string; city: string }>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = search
    ? availableCodes.filter(
        (c) =>
          c.code.toLowerCase().includes(search.toLowerCase()) ||
          c.city.toLowerCase().includes(search.toLowerCase()),
      )
    : availableCodes;

  const toggle = useCallback((code: string) => {
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= 4) return prev;
      return [...prev, code];
    });
  }, []);

  const runCompare = useCallback(async () => {
    if (selected.length < 2) return;
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ origin, month: String(month) });
      selected.forEach((c) => params.append("codes", c));
      const res = await fetch(`/api/deals/compare?${params}`);
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setResult(data as CompareResult);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [origin, month, selected]);

  useEffect(() => {
    if (selected.length >= 2) void runCompare();
    else setResult(null);
  }, [selected, runCompare]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[min(680px,95vw)] max-h-[85vh] overflow-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-bold text-slate-100">Compare Deals</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Picker */}
        <div className="px-5 py-4 border-b border-slate-800/50">
          <div className="text-xs font-medium text-slate-400 mb-2">
            Pick 2-4 destinations ({selected.length}/4 selected)
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search destinations..."
            spellCheck={false}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 outline-none mb-2"
          />
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {filtered.slice(0, 20).map((c) => {
              const isSelected = selected.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    isSelected
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  } ${!isSelected && selected.length >= 4 ? "opacity-40 cursor-default" : ""}`}
                  onClick={() => toggle(c.code)}
                  disabled={!isSelected && selected.length >= 4}
                >
                  {c.code} <span className="text-slate-500">{c.city}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <div className="px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-6 text-sm text-slate-400">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              Comparing...
            </div>
          )}

          {err && <div className="py-4 text-center text-sm text-red-400">{err}</div>}

          {result && result.deals.length >= 2 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500" />
                    {result.deals.map((d) => (
                      <th key={d.code} className="pb-2 text-center">
                        <div className="text-sm font-bold text-slate-100">{d.city ?? d.code}</div>
                        <div className="text-[10px] text-slate-500">{d.code}</div>
                        {d.code === result.cheapest && (
                          <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                            Cheapest
                          </span>
                        )}
                        {d.code === result.bestDeal && d.code !== result.cheapest && (
                          <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold text-amber-400">
                            Best deal
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  <Row label="Price">
                    {result.deals.map((d) => (
                      <td key={d.code} className={`py-2 text-center text-sm font-semibold ${d.code === result.cheapest ? "text-emerald-400" : "text-slate-200"}`}>
                        {d.price != null ? fmtUsd(d.price) : "\u2014"}
                      </td>
                    ))}
                  </Row>
                  <Row label="Deal quality">
                    {result.deals.map((d) => {
                      const { text, cls } = dealScoreLabel(d.dealScore);
                      return <td key={d.code} className={`py-2 text-center text-xs font-medium ${cls}`}>{text}</td>;
                    })}
                  </Row>
                  <Row label="Dates">
                    {result.deals.map((d) => (
                      <td key={d.code} className="py-2 text-center text-xs text-slate-400">
                        {d.departDate ? `${fmtDate(d.departDate)} \u2192 ${fmtDate(d.returnDate)}` : "\u2014"}
                      </td>
                    ))}
                  </Row>
                  <Row label="Trip length">
                    {result.deals.map((d) => (
                      <td key={d.code} className="py-2 text-center text-xs text-slate-400">
                        {d.tripDays != null ? `${d.tripDays} night${d.tripDays === 1 ? "" : "s"}` : "\u2014"}
                      </td>
                    ))}
                  </Row>
                  <Row label="Stops">
                    {result.deals.map((d) => (
                      <td key={d.code} className="py-2 text-center text-xs text-slate-400">
                        {d.transfers != null
                          ? d.transfers === 0 ? "Nonstop" : `${d.transfers} stop${d.transfers === 1 ? "" : "s"}`
                          : "\u2014"}
                      </td>
                    ))}
                  </Row>
                  <Row label="Travel time">
                    {result.deals.map((d) => (
                      <td key={d.code} className="py-2 text-center text-xs text-slate-400">{fmtDuration(d.durationMin)}</td>
                    ))}
                  </Row>
                  <Row label="Distance">
                    {result.deals.map((d) => (
                      <td key={d.code} className="py-2 text-center text-xs text-slate-400">
                        {d.distance != null ? `${d.distance.toLocaleString()} mi` : "\u2014"}
                      </td>
                    ))}
                  </Row>
                  <tr>
                    <td className="py-2" />
                    {result.deals.map((d) => (
                      <td key={d.code} className="py-2 text-center">
                        {d.deepLink ? (
                          <a
                            href={d.deepLink}
                            className="inline-block rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Book &rarr;
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600">\u2014</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {selected.length < 2 && !loading && (
            <div className="py-8 text-center text-sm text-slate-500">
              Select at least 2 destinations above to compare them side by side.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="py-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
        {label}
      </td>
      {children}
    </tr>
  );
}
