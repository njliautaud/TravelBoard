"use client";

import { useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lounge {
  id: string;
  name: string;
  airport: string;
  terminal: string;
  location: string;
  accessMethods: string[];
  amenities: string[];
  rating: number;
  reviewCount: number;
  hours: string;
  dayPassPrice: number | null;
  highlights: string[];
  userHasAccess: boolean;
}

const ACCESS_LABELS: Record<string, string> = {
  priority_pass: "Priority Pass",
  lounge_key: "Lounge Key",
  amex_centurion: "Amex Centurion",
  airline_status: "Airline Status",
  day_pass: "Day Pass",
  credit_card: "Credit Card",
};

const AMENITY_ICONS: Record<string, string> = {
  wifi: "\u{1F4F6}",
  food: "\u{1F37D}\uFE0F",
  bar: "\u{1F378}",
  showers: "\u{1F6BF}",
  spa: "\u{1F9D6}",
  nap_pods: "\u{1F6CF}\uFE0F",
  charging: "\u{1F50C}",
  game_room: "\u{1F3AE}",
  dining: "\u{1F374}",
  pool_table: "\u{1F3B1}",
};

const ACCESS_FILTER_OPTIONS = [
  { value: "priority_pass", label: "Priority Pass" },
  { value: "day_pass", label: "Day Pass" },
  { value: "amex_centurion", label: "Amex Centurion" },
  { value: "airline_status", label: "Airline Status" },
  { value: "credit_card", label: "Credit Card" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoungeFinder() {
  const [airport, setAirport] = useState("");
  const [lounges, setLounges] = useState<Lounge[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedLounge, setSelectedLounge] = useState<Lounge | null>(null);
  const [accessFilter, setAccessFilter] = useState<string[]>([]);

  const searchLounges = useCallback(async () => {
    if (!airport.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedLounge(null);
    try {
      const params = new URLSearchParams({ airport: airport.trim() });
      if (accessFilter.length) params.set("access", accessFilter.join(","));
      const res = await fetch(`/api/lounges/search?${params}`);
      const data = await res.json();
      if (data.lounges) setLounges(data.lounges);
      else setLounges([]);
    } catch {
      setLounges([]);
    }
    setLoading(false);
  }, [airport, accessFilter]);

  function toggleAccess(method: string) {
    setAccessFilter((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  }

  function renderStars(rating: number) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const stars: string[] = [];
    for (let i = 0; i < full; i++) stars.push("\u2605");
    if (half) stars.push("\u00BD");
    return (
      <span className="text-amber-400 text-xs">{stars.join("")} <span className="text-slate-500">{rating.toFixed(1)}</span></span>
    );
  }

  // ---- Render: Detail ----
  if (selectedLounge) {
    return (
      <div className="flex h-full flex-col bg-slate-950">
        <header className="border-b border-slate-800 px-4 py-3">
          <button onClick={() => setSelectedLounge(null)} className="mb-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back to results
          </button>
          <h2 className="text-lg font-bold text-slate-100">{selectedLounge.name}</h2>
          <p className="text-xs text-slate-500">{selectedLounge.airport} - Terminal {selectedLounge.terminal}</p>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-xl space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                {renderStars(selectedLounge.rating)}
                <span className="text-xs text-slate-500">{selectedLounge.reviewCount.toLocaleString()} reviews</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0">Location:</span>
                  <span className="text-slate-300">{selectedLounge.location}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0">Hours:</span>
                  <span className="text-slate-300">{selectedLounge.hours}</span>
                </div>
                {selectedLounge.dayPassPrice && (
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 shrink-0">Day Pass:</span>
                    <span className="text-amber-400 font-medium">${selectedLounge.dayPassPrice}</span>
                  </div>
                )}
              </div>

              {/* Access Methods */}
              <div>
                <h4 className="mb-2 text-xs font-medium text-slate-400">Access Methods</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLounge.accessMethods.map((m) => (
                    <span key={m} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                      {ACCESS_LABELS[m] ?? m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Amenities */}
              <div>
                <h4 className="mb-2 text-xs font-medium text-slate-400">Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedLounge.amenities.map((a) => (
                    <span key={a} className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300">
                      {AMENITY_ICONS[a] ?? ""} {a.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              {/* Highlights */}
              {selectedLounge.highlights.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-slate-400">Highlights</h4>
                  <ul className="space-y-1">
                    {selectedLounge.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="mt-0.5 text-amber-400">-</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Search & Results ----
  return (
    <div className="flex h-full flex-col bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">Lounge Finder</h2>
        <p className="text-xs text-slate-500">Find airport lounges and check access options</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-xl space-y-4">

          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Airport code (e.g. JFK, LAX, ATL)"
              value={airport}
              onChange={(e) => setAirport(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && searchLounges()}
              maxLength={4}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 uppercase tracking-wider focus:border-amber-500/60 focus:outline-none"
            />
            <button
              onClick={searchLounges}
              disabled={loading || !airport.trim()}
              className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? "..." : "Search"}
            </button>
          </div>

          {/* Access filters */}
          <div>
            <div className="mb-2 text-xs font-medium text-slate-400">Filter by access</div>
            <div className="flex flex-wrap gap-1.5">
              {ACCESS_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleAccess(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    accessFilter.includes(opt.value)
                      ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                      : "bg-slate-800 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Searching lounges...</div>
          ) : searched && lounges.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No lounges found for {airport}.</p>
              <p className="mt-1 text-xs text-slate-500">Try a major hub like JFK, LAX, ATL, ORD, or SFO.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lounges.map((lounge) => (
                <button
                  key={lounge.id}
                  onClick={() => setSelectedLounge(lounge)}
                  className="group w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900/80"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white">
                        {lounge.name}
                      </h3>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Terminal {lounge.terminal} - {lounge.location}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      {renderStars(lounge.rating)}
                      {lounge.dayPassPrice && (
                        <div className="mt-0.5 text-xs text-amber-400">${lounge.dayPassPrice} day pass</div>
                      )}
                    </div>
                  </div>

                  {/* Amenity icons row */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lounge.amenities.slice(0, 6).map((a) => (
                      <span key={a} className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {AMENITY_ICONS[a] ?? ""} {a.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>

                  {/* Access methods */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {lounge.accessMethods.map((m) => (
                      <span key={m} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                        {ACCESS_LABELS[m] ?? m}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Show search prompt if not searched yet */}
          {!searched && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/80">
                <span className="text-2xl">{"\u{1F6CB}\uFE0F"}</span>
              </div>
              <p className="text-sm text-slate-400">Search by airport code to find lounges.</p>
              <p className="mt-1 text-xs text-slate-500">We cover major US and international hubs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
