"use client";

/**
 * DealsTicker — animated cycling flight deals overlay on the map.
 *
 * Features:
 * - Auto-cycles through top deals every 5 seconds
 * - Smooth slide + fade transitions between deals
 * - Compact "deal card" with route, price, savings grade, airline
 * - Click to expand into full DealsMapPanel
 * - Pause on hover, manual prev/next
 * - Shows deal count badge + animated progress bar
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { alpha3ToCountryName } from "@/lib/countryCodes";
import { trackDealClick } from "@/lib/tracker";

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

interface DealsTickerProps {
  /** Called when a deal is clicked — parent can fly the map to the destination */
  onDealSelect?: (deal: DealItem) => void;
  /** Called to open full deals panel */
  onOpenPanel?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CYCLE_MS = 5000;
const TRANSITION_MS = 500;

const TIER_COLORS: Record<string, string> = {
  cheap: "text-teal-400",
  fair: "text-amber-400",
  splurge: "text-rose-400",
};

const GRADE_BG: Record<string, string> = {
  A: "from-emerald-500/30 to-emerald-600/10 border-emerald-500/50",
  B: "from-teal-500/30 to-teal-600/10 border-teal-500/50",
  C: "from-amber-500/30 to-amber-600/10 border-amber-500/50",
  D: "from-orange-500/30 to-orange-600/10 border-orange-500/50",
  F: "from-red-500/30 to-red-600/10 border-red-500/50",
};

const GRADE_TEXT: Record<string, string> = {
  A: "text-emerald-300",
  B: "text-teal-300",
  C: "text-amber-300",
  D: "text-orange-300",
  F: "text-red-300",
};

function dealGrade(savingsPercent: number): string {
  if (savingsPercent >= 45) return "A";
  if (savingsPercent >= 35) return "B";
  if (savingsPercent >= 20) return "C";
  if (savingsPercent >= 10) return "D";
  return "F";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// Animated Route Arrow (SVG)
// ---------------------------------------------------------------------------

function RouteArrow() {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" className="mx-1 flex-shrink-0">
      {/* Animated dashes along the route */}
      <line
        x1="0" y1="6" x2="20" y2="6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        className="text-slate-500"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="6"
          to="0"
          dur="1s"
          repeatCount="indefinite"
        />
      </line>
      {/* Airplane icon at the end */}
      <g transform="translate(18, 6)" className="text-amber-400">
        <polygon
          points="0,-3 10,0 0,3 2,0"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Single Deal Card (with enter/exit animation states)
// ---------------------------------------------------------------------------

function DealCard({
  deal,
  state,
  onClick,
}: {
  deal: DealItem;
  state: "entering" | "active" | "exiting";
  onClick: () => void;
}) {
  const grade = dealGrade(deal.savingsPercent);
  const tier = deal.tier ?? "fair";

  const animClass =
    state === "entering"
      ? "animate-deal-enter"
      : state === "exiting"
        ? "animate-deal-exit"
        : "opacity-100 translate-y-0";

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-xl border bg-gradient-to-r px-3 py-2.5 text-left transition-all duration-300 backdrop-blur-xl
        ${GRADE_BG[grade] ?? GRADE_BG.C}
        hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]
        ${animClass}`}
    >
      {/* Grade badge */}
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-950/60 text-sm font-black ${GRADE_TEXT[grade] ?? "text-slate-300"}`}>
        {grade}
      </span>

      {/* Route: ORIGIN → DEST */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-0.5 text-sm">
          <span className="font-bold text-slate-100">{deal.origin}</span>
          <RouteArrow />
          <span className="font-bold text-slate-100 truncate">{deal.destination}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
          {deal.airline && <span>{deal.airline}</span>}
          {deal.transfers != null && (
            <span className="flex items-center gap-0.5">
              {deal.transfers === 0 ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Nonstop
                </>
              ) : (
                `${deal.transfers} stop${deal.transfers > 1 ? "s" : ""}`
              )}
            </span>
          )}
          {deal.outboundDate && <span>{fmtDate(deal.outboundDate)}</span>}
        </div>
      </div>

      {/* Price */}
      <div className="flex-shrink-0 text-right">
        {deal.isAward ? (
          <>
            <div className="text-base font-black text-purple-400">{deal.miles?.toLocaleString()}</div>
            <div className="text-[9px] font-medium text-purple-400/70">miles</div>
          </>
        ) : (
          <>
            <div className={`text-base font-black ${TIER_COLORS[tier] ?? "text-slate-300"}`}>
              ${deal.price}
            </div>
            {deal.savingsPercent > 0 && (
              <div className="text-[9px] font-bold text-emerald-400">
                ▼ {deal.savingsPercent}% off
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Ticker Component
// ---------------------------------------------------------------------------

export default function DealsTicker({ onDealSelect, onOpenPanel }: DealsTickerProps) {
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [transState, setTransState] = useState<"active" | "exiting" | "entering">("active");
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Fetch deals on mount
  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      try {
        // Try settings for home airport, then localStorage, then default
        let origin = "MCO";
        try {
          const res = await fetch("/api/settings");
          const data = await res.json();
          const airports: string[] = data?.settings?.homeAirports ?? [];
          if (airports.length > 0) origin = airports[0]!;
        } catch {
          try {
            const raw = localStorage.getItem("travelboard.prefs");
            if (raw) {
              const prefs = JSON.parse(raw);
              if (prefs.homeAirport) origin = prefs.homeAirport.toUpperCase();
            }
          } catch { /* default */ }
        }

        const res = await fetch(`/api/fares/top-deals?origin=${origin}&limit=20`);
        const data = await res.json();
        if (data.deals?.length) {
          setDeals(data.deals);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetchDeals();
  }, []);

  // Auto-cycle timer
  useEffect(() => {
    if (deals.length <= 1 || paused || expanded) return;

    timerRef.current = setInterval(() => {
      // Exit current card
      setTransState("exiting");

      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % deals.length);
        setTransState("entering");

        setTimeout(() => {
          setTransState("active");
        }, 50);
      }, TRANSITION_MS);
    }, CYCLE_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [deals.length, paused, expanded]);

  // Restart progress bar animation on index change
  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.width = "0%";
    // Force reflow
    void el.offsetWidth;
    el.style.transition = `width ${CYCLE_MS}ms linear`;
    el.style.width = "100%";
  }, [currentIdx, paused]);

  const goTo = useCallback((direction: 1 | -1) => {
    setTransState("exiting");
    setTimeout(() => {
      setCurrentIdx((prev) => {
        const next = prev + direction;
        if (next < 0) return deals.length - 1;
        return next % deals.length;
      });
      setTransState("entering");
      setTimeout(() => setTransState("active"), 50);
    }, TRANSITION_MS / 2);
  }, [deals.length]);

  if (loading || deals.length === 0) return null;

  const deal = deals[currentIdx];
  if (!deal) return null;

  // Expanded list view
  if (expanded) {
    return (
      <div
        className="pointer-events-auto w-[320px] max-h-[60vh] flex flex-col rounded-2xl border border-slate-700/50 bg-slate-950/90 backdrop-blur-xl shadow-2xl overflow-hidden animate-deal-expand"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
            </span>
            <span className="text-xs font-semibold text-slate-200">
              {deals.length} Live Deals
            </span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        </div>

        {/* Scrollable deal list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {deals.map((d, i) => (
            <DealCard
              key={d.id}
              deal={d}
              state={i === currentIdx ? "active" : "active"}
              onClick={() => {
                setCurrentIdx(i);
                setExpanded(false);
                trackDealClick({
                  origin: d.origin,
                  destination: d.destination,
                  price: d.price,
                  source: d.source ?? undefined,
                  dealType: d.isAward ? "award" : "cash",
                });
                onDealSelect?.(d);
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Compact single-deal ticker
  return (
    <div
      className="pointer-events-auto w-[320px] flex flex-col rounded-2xl border border-slate-700/50 bg-slate-950/85 backdrop-blur-xl shadow-2xl overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Top bar: live indicator + deal count + expand */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Flight Deals
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">
            {currentIdx + 1}/{deals.length}
          </span>
          <button
            onClick={() => setExpanded(true)}
            className="rounded p-0.5 text-slate-500 transition hover:text-slate-300"
            title="Show all deals"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Deal card */}
      <div className="px-2 py-2">
        <DealCard
          deal={deal}
          state={transState}
          onClick={() => {
            trackDealClick({
              origin: deal.origin,
              destination: deal.destination,
              price: deal.price,
              source: deal.source ?? undefined,
              dealType: deal.isAward ? "award" : "cash",
            });
            onDealSelect?.(deal);
          }}
        />
      </div>

      {/* Progress bar + nav arrows */}
      <div className="flex items-center gap-1.5 px-3 pb-2">
        <button
          onClick={() => goTo(-1)}
          className="rounded p-0.5 text-slate-500 transition hover:text-slate-300"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            ref={progressRef}
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-teal-400"
            style={{ width: "0%", transition: `width ${CYCLE_MS}ms linear` }}
          />
        </div>

        <button
          onClick={() => goTo(1)}
          className="rounded p-0.5 text-slate-500 transition hover:text-slate-300"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
