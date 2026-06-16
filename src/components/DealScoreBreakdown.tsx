"use client";

/**
 * Deal score breakdown panel -- shows multi-factor quality score for a deal.
 * Expandable section in deal cards.
 */

import { useEffect, useState } from "react";

interface ScoreFactor {
  name: string;
  label: string;
  value: number;
  weight: number;
  detail: string;
}

interface ScoreData {
  flyTo: string;
  totalScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  factors: ScoreFactor[];
  summary: string;
}

const GRADE_COLORS: Record<string, { ring: string; bg: string; text: string }> = {
  A: { ring: "ring-emerald-500/40", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  B: { ring: "ring-teal-500/40", bg: "bg-teal-500/15", text: "text-teal-400" },
  C: { ring: "ring-amber-500/40", bg: "bg-amber-500/15", text: "text-amber-400" },
  D: { ring: "ring-orange-500/40", bg: "bg-orange-500/15", text: "text-orange-400" },
  F: { ring: "ring-red-500/40", bg: "bg-red-500/15", text: "text-red-400" },
};

function barColor(pct: number): string {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 45) return "bg-amber-500";
  return "bg-red-500";
}

function FactorBar({ factor }: { factor: ScoreFactor }) {
  const pct = Math.round(factor.value * 100);
  const weightPct = Math.round(factor.weight * 100);

  return (
    <div className="mb-2.5">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-slate-300">
          {factor.label}
          <span className="ml-1.5 text-[10px] text-slate-500">({weightPct}% weight)</span>
        </span>
        <span className={`text-[11px] font-semibold ${pct >= 70 ? "text-emerald-400" : pct >= 45 ? "text-amber-400" : "text-red-400"}`}>
          {pct}/100
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${barColor(pct)} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500">{factor.detail}</div>
    </div>
  );
}

export function DealScoreBreakdown({
  origin,
  dest,
  onClose,
}: {
  origin: string;
  dest: string;
  onClose?: () => void;
}) {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/deals/score?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d as ScoreData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [origin, dest]);

  if (loading) {
    return <div className="p-4 text-xs text-slate-500 animate-pulse">Analyzing deal quality...</div>;
  }

  if (!data) return null;

  const gc = GRADE_COLORS[data.grade] ?? GRADE_COLORS.C;

  return (
    <div className={`rounded-xl border ${gc.ring} ${gc.bg} p-4 mb-3`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gc.bg} ${gc.text} text-xl font-extrabold ring-1 ${gc.ring}`}>
          {data.grade}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-100">
            Deal Quality Score: {data.totalScore}/100
          </div>
          <div className="text-xs text-slate-400 truncate">{data.summary}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 transition hover:text-slate-300"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Factor bars */}
      {data.factors.map((f) => (
        <FactorBar key={f.name} factor={f} />
      ))}

      <div className="mt-2 text-[10px] text-slate-500 text-center">
        Score based on price, freshness, airline, routing, and travel time.
      </div>
    </div>
  );
}
