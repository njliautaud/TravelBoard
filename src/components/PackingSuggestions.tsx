"use client";

/**
 * Phase 4 — Smart Packing Suggestions panel.
 * Weather-aware packing recommendations grouped by category with
 * interactive checklist and progress tracking.
 */

import { useEffect, useState } from "react";

type PackCategory = "clothing" | "footwear" | "accessories" | "toiletries" | "electronics" | "documents";

interface PackItem {
  item: string;
  category: PackCategory;
  priority: "essential" | "recommended" | "optional";
  reason: string;
}

interface PackingSuggestion {
  destination: string;
  tripDays: number;
  weather: {
    tempHighC: number | null;
    tempLowC: number | null;
    summary: string;
    isClimateNormal: boolean;
  };
  items: PackItem[];
  tips: string[];
}

const CATEGORY_LABELS: Record<PackCategory, string> = {
  clothing: "Clothing",
  footwear: "Footwear",
  accessories: "Accessories",
  toiletries: "Toiletries",
  electronics: "Electronics",
  documents: "Documents",
};

const CATEGORY_ICONS: Record<PackCategory, string> = {
  clothing: "\uD83D\uDC55",
  footwear: "\uD83D\uDC5F",
  accessories: "\uD83C\uDF92",
  toiletries: "\uD83E\uDDF4",
  electronics: "\uD83D\uDD0C",
  documents: "\uD83D\uDCC4",
};

const PRIORITY_CLASSES: Record<string, string> = {
  essential: "text-red-400",
  recommended: "text-amber-400",
  optional: "text-blue-400",
};

function tempF(c: number): string {
  return `${Math.round(c * 9 / 5 + 32)}`;
}

export default function PackingSuggestions({
  lat,
  lon,
  destination,
  departDate,
  returnDate,
  onClose,
}: {
  lat: number;
  lon: number;
  destination: string;
  departDate: string;
  returnDate?: string;
  onClose?: () => void;
}) {
  const [data, setData] = useState<PackingSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      destination,
      departDate,
    });
    if (returnDate) params.set("returnDate", returnDate);

    fetch(`/api/packing?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lat, lon, destination, departDate, returnDate]);

  const toggleItem = (item: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-lg text-center">
        <p className="text-sm text-slate-400 animate-pulse">Generating packing list...</p>
      </div>
    );
  }

  if (!data) return null;

  // Group items by category
  const grouped = new Map<PackCategory, PackItem[]>();
  for (const item of data.items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const progress = data.items.length > 0
    ? Math.round((checkedItems.size / data.items.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-100">
          Packing list for {destination}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close packing list"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Weather summary */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-300 backdrop-blur-lg">
        <span className="capitalize">{data.weather.summary}</span>
        {data.weather.tempHighC != null && data.weather.tempLowC != null && (
          <span>
            {tempF(data.weather.tempLowC)}&ndash;{tempF(data.weather.tempHighC)}&deg;F
          </span>
        )}
        <span>{data.tripDays} day{data.tripDays !== 1 ? "s" : ""}</span>
        {data.weather.isClimateNormal && (
          <span className="italic text-slate-500">Based on typical weather</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-lg">
        <div className="mb-1 flex justify-between text-xs text-slate-400">
          <span>Packed: {checkedItems.size}/{data.items.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progress === 100
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-amber-500 to-amber-400"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items by category */}
      {Array.from(grouped.entries()).map(([category, items]) => (
        <div
          key={category}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-lg"
        >
          <p className="mb-2 text-xs font-semibold text-slate-400">
            {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}
          </p>
          <div className="space-y-1">
            {items.map((item) => {
              const checked = checkedItems.has(item.item);
              return (
                <label
                  key={item.item}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-800/40 ${
                    checked ? "opacity-40 line-through" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(item.item)}
                    className="mt-1 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-slate-200">{item.item}</span>
                    <span className={`ml-1.5 text-[10px] font-bold uppercase ${PRIORITY_CLASSES[item.priority]}`}>
                      {item.priority}
                    </span>
                    <p className="text-xs text-slate-500">{item.reason}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {/* Tips */}
      {data.tips.length > 0 && (
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/20 p-4">
          <p className="mb-2 text-xs font-semibold text-amber-400">Tips</p>
          <ul className="space-y-1 pl-4 text-sm text-slate-300">
            {data.tips.map((tip, i) => (
              <li key={i} className="list-disc">{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
