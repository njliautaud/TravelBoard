"use client";

import { useCallback, useEffect, useState } from "react";
import { HOME_AIRPORTS, type AirportOption } from "@/lib/airports";
import { alpha3ToCountryName } from "@/lib/countryCodes";
import { trackDealClick, trackDealSave } from "@/lib/tracker";
import type { CountryDeal, DealRoute } from "./TravelMap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DealItem {
  id: string;
  origin: string;
  destination: string;
  flyToCode: string;
  month: number;
  price: number;
  currency: string;
  airline: string | null;
  source: string | null;
  dealScore: number | null;
  tier: string | null;
  lastSeen: string;
  savingsPercent: number;
  outboundDate: string | null;
  returnDate: string | null;
  transfers?: number | null;
  duration?: number | null;
  deepLink?: string;
  countryTo?: string;
  isAward?: boolean;
  miles?: number;
  programName?: string;
  cabinLabel?: string;
  tripType?: string;
}

interface DealsMapPanelProps {
  dealRoutes: DealRoute[];
  countryDeals: CountryDeal[];
  /** ISO-3 country code to filter deals to, set when user clicks a country on map */
  countryFilter: string | null;
  onClearFilter: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<string, string> = {
  cheap: "text-teal-400",
  fair: "text-amber-400",
  splurge: "text-rose-400",
};

const TIER_DOT: Record<string, string> = {
  cheap: "bg-teal-400",
  fair: "bg-amber-400",
  splurge: "bg-rose-400",
};

const GRADE_COLORS: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  B: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  C: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  D: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  F: "bg-red-500/20 text-red-300 border-red-500/40",
};

function dealGrade(savingsPercent: number): string {
  if (savingsPercent >= 45) return "A";
  if (savingsPercent >= 35) return "B";
  if (savingsPercent >= 20) return "C";
  if (savingsPercent >= 10) return "D";
  return "F";
}

/** Resolve an ISO-3 country code to a display name, falling back to the raw code. */
function countryDisplayName(code: string): string {
  return alpha3ToCountryName(code) ?? code;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CompactDealCard({ deal, onClick }: { deal: DealItem; onClick?: () => void }) {
  const tier = deal.tier ?? "fair";
  const grade = dealGrade(deal.savingsPercent);

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-700/40 bg-slate-800/50 px-3 py-2.5 text-left transition hover:border-slate-600/60 hover:bg-slate-800/80"
    >
      {/* Deal grade badge */}
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${GRADE_COLORS[grade] ?? GRADE_COLORS.C}`}
      >
        {grade}
      </span>

      {/* Destination info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-100 group-hover:text-white">
            {deal.destination}
          </span>
          <span className="flex-shrink-0 text-[10px] text-slate-500">{deal.flyToCode}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
          {deal.airline && <span>{deal.airline}</span>}
          {deal.transfers != null && (
            <span>{deal.transfers === 0 ? "Nonstop" : `${deal.transfers} stop${deal.transfers > 1 ? "s" : ""}`}</span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="flex-shrink-0 text-right">
        {deal.isAward ? (
          <>
            <div className="text-sm font-bold text-purple-400">
              {deal.miles?.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500">miles</div>
          </>
        ) : (
          <>
            <div className={`text-sm font-bold ${TIER_COLORS[tier] ?? "text-slate-300"}`}>
              ${deal.price}
            </div>
            {deal.savingsPercent > 0 && (
              <div className="text-[10px] font-medium text-emerald-400">
                -{deal.savingsPercent}%
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
}

function DealDetailOverlay({
  deal,
  onClose,
}: {
  deal: DealItem;
  onClose: () => void;
}) {
  const tier = deal.tier ?? "fair";
  const grade = dealGrade(deal.savingsPercent);

  return (
    <div className="flex flex-col gap-3 p-4">
      <button
        onClick={onClose}
        className="self-start rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      >
        &larr; Back
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{deal.destination}</h3>
          <p className="text-sm text-slate-400">{deal.flyToCode} from {deal.origin}</p>
        </div>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold ${GRADE_COLORS[grade] ?? GRADE_COLORS.C}`}
        >
          {grade}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        {deal.isAward ? (
          <>
            <span className="text-2xl font-bold text-purple-400">{deal.miles?.toLocaleString()}</span>
            <span className="text-sm text-slate-400">miles</span>
            {deal.cabinLabel && (
              <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300 capitalize">
                {deal.cabinLabel}
              </span>
            )}
          </>
        ) : (
          <>
            <span className={`text-2xl font-bold ${TIER_COLORS[tier]}`}>${deal.price}</span>
            {deal.savingsPercent > 0 && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                Save {deal.savingsPercent}%
              </span>
            )}
          </>
        )}
      </div>

      {/* Meta details */}
      <div className="space-y-2 rounded-xl border border-slate-700/40 bg-slate-800/30 p-3">
        {deal.airline && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Airline</span>
            <span className="text-slate-300">{deal.airline}</span>
          </div>
        )}
        {deal.outboundDate && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Depart</span>
            <span className="text-slate-300">{new Date(deal.outboundDate).toLocaleDateString()}</span>
          </div>
        )}
        {deal.returnDate && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Return</span>
            <span className="text-slate-300">{new Date(deal.returnDate).toLocaleDateString()}</span>
          </div>
        )}
        {deal.transfers != null && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Stops</span>
            <span className="text-slate-300">{deal.transfers === 0 ? "Nonstop" : `${deal.transfers}`}</span>
          </div>
        )}
        {deal.source && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Source</span>
            <span className="text-slate-300">{deal.source}</span>
          </div>
        )}
        {deal.isAward && deal.programName && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Program</span>
            <span className="text-slate-300">{deal.programName}</span>
          </div>
        )}
      </div>

      {deal.deepLink && (
        <a
          href={deal.deepLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackDealClick({
            origin: deal.origin,
            destination: deal.destination,
            price: deal.price,
            source: "book_click",
            dealType: deal.isAward ? "award" : "cash",
          })}
          className="block rounded-xl bg-teal-500/15 py-2.5 text-center text-sm font-medium text-teal-300 transition hover:bg-teal-500/25"
        >
          View &amp; Book
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DealsMapPanel({
  dealRoutes,
  countryDeals,
  countryFilter,
  onClearFilter,
}: DealsMapPanelProps) {
  const [origin, setOrigin] = useState<string>("");
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealItem | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Load default origin — try settings first, fall back to localStorage prefs
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const airports: string[] = data?.settings?.homeAirports ?? [];
        if (airports.length > 0 && !origin) {
          setOrigin(airports[0]!);
        } else if (!origin) {
          // Fall back to onboarding prefs in localStorage
          try {
            const raw = localStorage.getItem("travelboard.prefs");
            if (raw) {
              const prefs = JSON.parse(raw);
              if (prefs.homeAirport) setOrigin(prefs.homeAirport.toUpperCase());
              else setOrigin("MCO"); // Ultimate default
            } else {
              setOrigin("MCO");
            }
          } catch {
            setOrigin("MCO");
          }
        }
      })
      .catch(() => {
        // API unavailable — use localStorage or default
        try {
          const raw = localStorage.getItem("travelboard.prefs");
          if (raw) {
            const prefs = JSON.parse(raw);
            if (prefs.homeAirport) setOrigin(prefs.homeAirport.toUpperCase());
            else setOrigin("MCO");
          } else {
            setOrigin("MCO");
          }
        } catch {
          setOrigin("MCO");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch deals list
  const fetchDeals = useCallback(async () => {
    if (!origin) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({ origin, limit: "50" });
      const res = await fetch(`/api/fares/top-deals?${params}`);
      const data = await res.json();
      setDeals(data.deals ?? []);
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [origin]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Filter deals by country when a country is clicked on the map
  const filteredDeals = countryFilter
    ? deals.filter((d) => {
        // Match by countryTo name against our country code lookup
        const countryName = alpha3ToCountryName(countryFilter)?.toLowerCase();
        if (countryName && d.countryTo?.toLowerCase() === countryName) return true;
        // Also check if any deal route for this destination is in the filtered country
        const matchingRoute = dealRoutes.find(
          (r) => r.destination === d.flyToCode
        );
        if (matchingRoute) {
          // Check if the country deal matches this filter
          const countryDeal = countryDeals.find((cd) => cd.countryCode === countryFilter);
          if (countryDeal) return true;
        }
        return false;
      })
    : deals;

  // Stats summary
  const cheapCount = countryDeals.filter((d) => d.tier === "cheap").length;
  const totalCountries = countryDeals.length;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute right-0 top-0 flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/80 px-3 py-2 backdrop-blur-lg transition hover:bg-slate-800/80"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-teal-400">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        <span className="text-xs font-medium text-slate-300">
          {filteredDeals.length} deals
        </span>
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-lg shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-teal-400">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <span className="text-sm font-semibold text-slate-200">Flight Deals</span>
          {loading && (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400" />
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          title="Minimize panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      </div>

      {/* Origin selector */}
      <div className="border-b border-slate-700/30 px-3 py-2">
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="w-full rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 focus:border-teal-500/50 focus:outline-none"
        >
          <option value="">Select origin</option>
          {HOME_AIRPORTS.map((a: AirportOption) => (
            <option key={a.iata} value={a.iata}>
              {a.iata} -- {a.city}
            </option>
          ))}
        </select>
      </div>

      {/* Country filter banner */}
      {countryFilter && (
        <div className="flex items-center justify-between border-b border-slate-700/30 bg-teal-500/10 px-3 py-2">
          <span className="text-xs font-medium text-teal-300">
            Filtered: {countryDisplayName(countryFilter)}
          </span>
          <button
            onClick={onClearFilter}
            className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            Clear
          </button>
        </div>
      )}

      {/* Summary stats */}
      <div className="flex items-center gap-3 border-b border-slate-700/30 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${TIER_DOT.cheap}`} />
          <span className="text-[11px] text-slate-400">{cheapCount} cheap</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${TIER_DOT.fair}`} />
          <span className="text-[11px] text-slate-400">{countryDeals.filter((d) => d.tier === "fair").length} fair</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${TIER_DOT.splurge}`} />
          <span className="text-[11px] text-slate-400">{countryDeals.filter((d) => d.tier === "splurge").length} splurge</span>
        </div>
        <span className="ml-auto text-[10px] text-slate-500">
          {totalCountries} countries
        </span>
      </div>

      {/* Deal cards list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {selectedDeal ? (
          <DealDetailOverlay deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
        ) : filteredDeals.length === 0 && !loading ? (
          <div className="flex h-32 items-center justify-center text-center">
            <p className="text-xs text-slate-500 px-4">
              {countryFilter
                ? "No deals found for this country. Try clicking a different country or clear the filter."
                : origin
                  ? "No deals available right now. Try a different airport."
                  : "Select an origin airport to see deals."}
            </p>
          </div>
        ) : (
          filteredDeals.map((deal) => (
            <CompactDealCard
              key={deal.id}
              deal={deal}
              onClick={() => {
                trackDealClick({
                  origin: deal.origin,
                  destination: deal.destination,
                  price: deal.price,
                  source: deal.source ?? undefined,
                  dealType: deal.isAward ? "award" : "cash",
                });
                setSelectedDeal(deal);
              }}
            />
          ))
        )}
      </div>

      {/* Footer legend */}
      <div className="border-t border-slate-700/30 px-3 py-1.5">
        <p className="text-[10px] text-slate-500 text-center">
          Click a country on the map to filter deals
        </p>
      </div>
    </div>
  );
}
