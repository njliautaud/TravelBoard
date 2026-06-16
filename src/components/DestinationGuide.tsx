"use client";

/**
 * Destination guide panel -- shows brief info about a destination:
 * best time to visit, weather, visa requirements, currency, time zone, highlights.
 */

import { useEffect, useState } from "react";

interface GuideData {
  code: string;
  city: string;
  country: string;
  region: string;
  bestTimeToVisit: string;
  peakSeason: string;
  avgTempHighF: { summer: number; winter: number };
  avgTempLowF: { summer: number; winter: number };
  visaRequired: boolean;
  visaNote: string;
  currency: string;
  currencyCode: string;
  timeZone: string;
  utcOffset: string;
  languages: string[];
  highlights: string[];
  description: string;
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex gap-2 py-2 border-b border-slate-800/60">
      <span className="w-6 text-center text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="text-sm text-slate-200 leading-relaxed">{value}</div>
      </div>
    </div>
  );
}

export function DestinationGuidePanel({
  code,
  onClose,
}: {
  code: string;
  onClose?: () => void;
}) {
  const [guide, setGuide] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/destinations/${encodeURIComponent(code)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setGuide(d as GuideData); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        <div className="mt-2 text-xs text-slate-500">Loading destination guide...</div>
      </div>
    );
  }

  if (notFound || !guide) {
    return (
      <div className="p-6 text-center text-sm text-slate-400">
        No guide available for {code} yet. We are adding more destinations over time.
        {onClose && (
          <div className="mt-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  }

  // Determine season
  const now = new Date();
  const month = now.getMonth();
  const isSummer = guide.region === "oceania" || guide.region === "south-america"
    ? month >= 9 || month <= 2
    : month >= 4 && month <= 9;
  const tempHigh = isSummer ? guide.avgTempHighF.summer : guide.avgTempHighF.winter;
  const tempLow = isSummer ? guide.avgTempLowF.summer : guide.avgTempLowF.winter;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100">
            {guide.city}, {guide.country}
          </h3>
          <div className="text-xs text-slate-400 mt-0.5">
            {guide.code} | {guide.region.replace("-", " ")}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 transition hover:text-slate-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-slate-300 mb-4">{guide.description}</p>

      {/* Info rows */}
      <InfoRow icon="&#128197;" label="Best time to visit" value={guide.bestTimeToVisit} />
      <InfoRow
        icon="&#127777;"
        label={`Weather (${isSummer ? "summer" : "winter"} now)`}
        value={`${tempLow}-${tempHigh} F | Peak season: ${guide.peakSeason}`}
      />
      <InfoRow
        icon={guide.visaRequired ? "&#128203;" : "&#9989;"}
        label="Visa"
        value={guide.visaNote}
      />
      <InfoRow icon="&#128177;" label="Currency" value={`${guide.currency} (${guide.currencyCode})`} />
      <InfoRow icon="&#128336;" label="Time zone" value={`${guide.timeZone} (${guide.utcOffset})`} />
      <InfoRow icon="&#128483;" label="Languages" value={guide.languages.join(", ")} />

      {/* Highlights */}
      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Highlights
        </div>
        <div className="flex flex-wrap gap-1.5">
          {guide.highlights.map((h) => (
            <span
              key={h}
              className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-300"
            >
              {h}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
