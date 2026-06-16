"use client";

import { useState } from "react";

interface CalcOption {
  partner: string;
  pointsCost: number;
  cabin: string;
  route: string;
  airline: string;
  notes: string;
  reachableFrom: string[];
  valueCpp: number | null;
}

interface CalcResult {
  destination: string;
  region: string;
  cashPrice: number | null;
  cabin: string;
  options: CalcOption[];
}

export default function PointsCalculator() {
  const [destination, setDestination] = useState("");
  const [cashPrice, setCashPrice] = useState("");
  const [cabin, setCabin] = useState("economy");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCalculate() {
    if (!destination.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/points/calculator", {
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
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Calculate Points Cost</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Destination (IATA)</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="NRT"
              maxLength={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Cash Price (optional)</label>
            <input
              value={cashPrice}
              onChange={(e) => setCashPrice(e.target.value)}
              placeholder="$850"
              type="number"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Cabin</label>
            <select
              value={cabin}
              onChange={(e) => setCabin(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
            >
              <option value="economy">Economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
              <option value="any">Any cabin</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleCalculate}
          disabled={loading || !destination.trim()}
          className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? "Calculating..." : "Calculate"}
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-slate-500">Region:</span>
            <span className="text-sm font-medium text-slate-300">{result.region}</span>
            {result.cashPrice && (
              <>
                <span className="text-xs text-slate-500 ml-3">Cash fare:</span>
                <span className="text-sm font-medium text-amber-400">${result.cashPrice}</span>
              </>
            )}
          </div>

          {result.options.length === 0 ? (
            <p className="text-sm text-slate-400">No award options found for this route and cabin.</p>
          ) : (
            <div className="space-y-2">
              {result.options.map((opt, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-amber-400">
                          {opt.pointsCost.toLocaleString()} pts
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {opt.cabin}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-300">{opt.partner}</p>
                      <p className="text-xs text-slate-500">
                        {opt.airline} &middot; {opt.notes}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {opt.reachableFrom.map((prog) => (
                          <span
                            key={prog}
                            className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400"
                          >
                            {prog}
                          </span>
                        ))}
                      </div>
                    </div>
                    {opt.valueCpp != null && (
                      <div className="text-right shrink-0">
                        <span className="text-lg font-bold text-emerald-400">{opt.valueCpp}</span>
                        <span className="text-xs text-slate-500 block">cpp</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
