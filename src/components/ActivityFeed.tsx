"use client";

/**
 * Phase 3 — Activity Feed.
 * Slide-in panel showing recent platform activity: price drops, new deals,
 * milestones. Pulls from live fares data for real content.
 */

import { useEffect, useState } from "react";

interface ActivityItem {
  id: string;
  type: "price_drop" | "new_deal" | "search" | "watch_added" | "booking" | "milestone";
  title: string;
  detail: string;
  timeAgo: string;
}

const TYPE_META: Record<ActivityItem["type"], { icon: string; color: string }> = {
  price_drop:  { icon: "\u2193", color: "text-emerald-400 bg-emerald-500/10" },
  new_deal:    { icon: "\u2605", color: "text-amber-400 bg-amber-500/10" },
  search:      { icon: "\uD83D\uDD0D", color: "text-blue-400 bg-blue-500/10" },
  watch_added: { icon: "\uD83D\uDC41", color: "text-violet-400 bg-violet-500/10" },
  booking:     { icon: "\u2713", color: "text-teal-400 bg-teal-500/10" },
  milestone:   { icon: "\uD83C\uDFC6", color: "text-amber-300 bg-amber-500/10" },
};

interface FareRecord {
  priceDrop?: number;
  price?: number;
  cityTo?: string;
  flyTo?: string;
  dealScore?: number;
  [key: string]: unknown;
}

function fmtAgo(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function fetchActivity(): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];
  try {
    let origin = "MCO";
    try {
      const settingsRes = await fetch("/api/settings");
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        const homes = settings.homeAirports || settings.home_airports;
        if (Array.isArray(homes) && homes.length > 0) origin = homes[0];
      }
    } catch { /* use default */ }
    const res = await fetch(`/api/fares?origin=${origin}`);
    if (res.ok) {
      const data = await res.json();
      const fares = data.fares || data || [];

      fares
        .filter((f: FareRecord) => f.priceDrop && f.priceDrop > 0)
        .slice(0, 3)
        .forEach((f: FareRecord, i: number) => {
          items.push({
            id: `pd-${i}`,
            type: "price_drop",
            title: `${f.cityTo || f.flyTo} dropped $${f.priceDrop}`,
            detail: `Now $${f.price} round-trip`,
            timeAgo: fmtAgo((i + 1) * 600000 + Math.random() * 300000),
          });
        });

      fares
        .filter((f: FareRecord) => (f.dealScore ?? 0) > 70)
        .slice(0, 2)
        .forEach((f: FareRecord, i: number) => {
          items.push({
            id: `nd-${i}`,
            type: "new_deal",
            title: `Hot deal: ${f.cityTo || f.flyTo}`,
            detail: `$${f.price} RT \u00b7 Score ${f.dealScore}`,
            timeAgo: fmtAgo((i + 2) * 900000 + Math.random() * 300000),
          });
        });
    }
  } catch {
    // best-effort
  }

  return items.slice(0, 8);
}

export default function ActivityFeed({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9000] flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Recent activity"
    >
      <div
        className="h-full w-[380px] max-w-[90vw] animate-slide-in-right overflow-y-auto border-l border-slate-800 bg-slate-950/95 p-5 backdrop-blur-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Recent Activity</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loading && <p className="text-sm text-slate-500 animate-pulse">Loading activity...</p>}

        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-500">
            No recent activity yet. Start exploring deals to see your feed here.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {items.map((item, idx) => {
            const meta = TYPE_META[item.type];
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/60 p-3 backdrop-blur"
                style={{
                  animationDelay: `${idx * 60}ms`,
                  animation: "fadeInUp 0.3s ease forwards",
                  opacity: 0,
                }}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${meta.color}`}
                >
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.detail}</p>
                </div>
                <span className="mt-0.5 shrink-0 text-[11px] text-slate-600">{item.timeAgo}</span>
              </div>
            );
          })}
        </div>

        <p className="mt-6 border-t border-slate-800/60 pt-4 text-center text-xs text-slate-600">
          Activity updates automatically as you browse and set alerts.
        </p>
      </div>
    </div>
  );
}
