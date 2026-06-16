"use client";

/**
 * Changelog / "What's New" modal with sparkle indicator hook.
 */

import { useEffect, useState } from "react";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  description: string;
  category: "feature" | "improvement" | "fix" | "security";
}

const LAST_SEEN_KEY = "travelboard.changelog_seen";

const categoryStyles: Record<string, { badge: string; border: string; label: string }> = {
  feature: {
    badge: "bg-emerald-500/15 text-emerald-400",
    border: "border-l-emerald-500",
    label: "New",
  },
  improvement: {
    badge: "bg-blue-500/15 text-blue-400",
    border: "border-l-blue-500",
    label: "Improved",
  },
  fix: {
    badge: "bg-amber-500/15 text-amber-400",
    border: "border-l-amber-500",
    label: "Fixed",
  },
  security: {
    badge: "bg-pink-500/15 text-pink-400",
    border: "border-l-pink-500",
    label: "Security",
  },
};

// Hardcoded changelog entries for the investor demo (no API dependency)
const DEMO_ENTRIES: ChangelogEntry[] = [
  {
    version: "1.5.0",
    date: "2026-06-16",
    title: "Deal Map Overlay",
    description: "See flight deals pinned directly on the world map with color-coded tiers. Toggle between your wish list and live deals.",
    category: "feature",
  },
  {
    version: "1.4.0",
    date: "2026-06-15",
    title: "Calendar Heatmap Search",
    description: "Find the cheapest days to fly with a visual calendar heatmap. Green means cheap, red means expensive.",
    category: "feature",
  },
  {
    version: "1.3.0",
    date: "2026-06-14",
    title: "Deal Score Breakdown",
    description: "Understand why a deal is rated A through F with detailed factor-by-factor scoring breakdown.",
    category: "improvement",
  },
  {
    version: "1.2.0",
    date: "2026-06-12",
    title: "Side-by-Side Comparison",
    description: "Compare up to 4 destinations side by side -- price, travel time, deal quality, and more.",
    category: "feature",
  },
  {
    version: "1.1.0",
    date: "2026-06-10",
    title: "Destination Guides",
    description: "Click a country to see best time to visit, visa requirements, weather, and local highlights.",
    category: "feature",
  },
  {
    version: "1.0.0",
    date: "2026-06-01",
    title: "TravelBoard Launch",
    description: "The world map, wishlist, flight deal tracking, and alert system -- all in one place.",
    category: "feature",
  },
];

export function Changelog({ onClose }: { onClose: () => void }) {
  const [entries] = useState<ChangelogEntry[]>(DEMO_ENTRIES);

  useEffect(() => {
    // Mark latest as seen
    const first = entries[0];
    if (first) {
      try {
        localStorage.setItem(LAST_SEEN_KEY, first.version);
      } catch {}
    }
  }, [entries]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[min(520px,90vw)] max-h-[80vh] overflow-auto rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-100">What&apos;s New</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {entries.map((entry) => {
            const cat = categoryStyles[entry.category] ?? categoryStyles.feature;
            return (
              <div
                key={entry.version}
                className={`rounded-xl border-l-[3px] ${cat.border} bg-slate-900/80 p-4`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.badge}`}>
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-slate-500">v{entry.version}</span>
                  </div>
                  <span className="text-[11px] text-slate-600">{entry.date}</span>
                </div>
                <div className="text-sm font-semibold text-slate-100 mb-1">{entry.title}</div>
                <div className="text-xs leading-relaxed text-slate-400">{entry.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Hook to track unseen changelog count. */
export function useUnseenChangelog(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY) ?? "0.0.0";
      const unseen = DEMO_ENTRIES.filter((e) => e.version > lastSeen).length;
      setCount(unseen);
    } catch {
      setCount(0);
    }
  }, []);

  return count;
}
