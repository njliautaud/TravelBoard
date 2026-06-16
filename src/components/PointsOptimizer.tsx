"use client";

import { useState } from "react";

interface TransferPath {
  fromProgram: string;
  fromProgramLabel: string;
  toPartner: string;
  pointsNeeded: number;
  pointsFromBalance: number;
  transferRatio: number;
  bonusPct: number;
  transferTime: string;
  cabin: string;
  route: string;
  valueCentsPerPoint: number;
  cashAlternative: number | null;
}

interface OptResult {
  destination: string;
  region: string;
  bestPaths: TransferPath[];
  sweetSpots: Array<{ partner: string; route: string; cabin: string; pointsCost: number; notes: string; airline: string }>;
  userPrograms: Array<{ program: string; label: string; balance: number; cards: string[] }>;
  summary: string;
}

export default function PointsOptimizer() {
  const [destination, setDestination] = useState("");
  const [cashPrice, setCashPrice] = useState("");
  const [cabin, setCabin] = useState("economy");
  const [result, setResult] = useState<OptResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOptimize() {
    if (!destination.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/points/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destination.trim().toUpperCase(),
          cashPrice: cashPrice ? parseFloat(cashPrice) : null,
          cabin,
        }),
      });
      if (res.ok) setResult(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Optimize Transfer Path</h3>
        <p className="mb-3 text-xs text-slate-500">
          Find the best way to use your card points for a destination. Add your cards in Card Manager first.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Destination (NRT)"
            maxLength={3}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            value={cashPrice}
            onChange={(e) => setCashPrice(e.target.value)}
            placeholder="Cash price (optional)"
            type="number"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <select
            value={cabin}
            onChange={(e) => setCabin(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
          >
            <option value="economy">Economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
            <option value="any">Any cabin</option>
          </select>
        </div>
        <button
          onClick={handleOptimize}
          disabled={loading || !destination.trim()}
          className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? "Optimizing..." : "Find Best Path"}
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-sm text-amber-200">{result.summary}</p>
          </div>

          {/* User Programs */}
          {result.userPrograms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.userPrograms.map((p) => (
                <div key={p.program} className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                  <span className="text-xs text-slate-400">{p.label}</span>
                  <span className="ml-2 text-sm font-semibold text-slate-200">
                    {p.balance.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Transfer Paths */}
          {result.bestPaths.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Transfer Options</h4>
              {result.bestPaths.map((path, i) => {
                const canCover = path.pointsFromBalance >= path.pointsNeeded;
                return (
                  <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-amber-400">
                            {path.pointsNeeded.toLocaleString()} pts
                          </span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600 shrink-0">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm text-slate-300">{path.toPartner}</span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                            {path.cabin}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          From {path.fromProgramLabel} &middot; {path.transferTime} &middot; {path.transferRatio}:1 ratio
                          {path.bonusPct > 0 && (
                            <span className="ml-1 text-emerald-400">+{path.bonusPct}% bonus!</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {canCover ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                            Covered
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                            Need {(path.pointsNeeded - path.pointsFromBalance).toLocaleString()} more
                          </span>
                        )}
                        {path.cashAlternative != null && path.valueCentsPerPoint > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            {path.valueCentsPerPoint} cpp vs ${path.cashAlternative}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
