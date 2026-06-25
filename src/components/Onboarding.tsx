"use client";

/**
 * Onboarding wizard - 2-step flow for new users:
 * 1. Where do you fly from? (multi-select airports, top 8 geo-sorted)
 * 2. What are you looking for? (travel style card + top loyalty chip toggles)
 *
 * After answering, saves to DB and triggers personalized deal fetch.
 */

import { useEffect, useMemo, useState } from "react";
import { HOME_AIRPORTS, sortAirportsByDistance, type AirportOption } from "@/lib/airports";

// Re-export for backward compatibility
export interface TravelPrefsDto {
  homeAirport: string;
  maxTravelHours: number;
  maxLayoverHours: number;
  layoverDayTrip: boolean;
  cabin: "economy" | "premium" | "any";
  nonstopOnly: boolean;
  preferFarther: boolean;
}

export const DEFAULT_PREFS: TravelPrefsDto = {
  homeAirport: "MCO",
  maxTravelHours: 24,
  maxLayoverHours: 8,
  layoverDayTrip: false,
  cabin: "any",
  nonstopOnly: false,
  preferFarther: false,
};

export const PREFS_LS_KEY = "travelboard.prefs";
export const ONBOARDED_LS_KEY = "travelboard.onboarded";

export function loadLocalPrefs(): { prefs: TravelPrefsDto; onboarded: boolean } {
  let prefs = DEFAULT_PREFS;
  let onboarded = false;
  try {
    onboarded = window.localStorage.getItem(ONBOARDED_LS_KEY) === "1";
    const raw = window.localStorage.getItem(PREFS_LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TravelPrefsDto>;
      prefs = {
        homeAirport:
          typeof p.homeAirport === "string" && /^[A-Za-z]{3}$/.test(p.homeAirport)
            ? p.homeAirport.toUpperCase()
            : DEFAULT_PREFS.homeAirport,
        maxTravelHours: clampNum(p.maxTravelHours, 4, 72, DEFAULT_PREFS.maxTravelHours),
        maxLayoverHours: clampNum(p.maxLayoverHours, 1, 48, DEFAULT_PREFS.maxLayoverHours),
        layoverDayTrip: typeof p.layoverDayTrip === "boolean" ? p.layoverDayTrip : DEFAULT_PREFS.layoverDayTrip,
        cabin: p.cabin === "economy" || p.cabin === "premium" || p.cabin === "any" ? p.cabin : DEFAULT_PREFS.cabin,
        nonstopOnly: typeof p.nonstopOnly === "boolean" ? p.nonstopOnly : DEFAULT_PREFS.nonstopOnly,
        preferFarther: typeof p.preferFarther === "boolean" ? p.preferFarther : DEFAULT_PREFS.preferFarther,
      };
    }
  } catch { /* private mode / kiosk -- defaults */ }
  return { prefs, onboarded };
}

function clampNum(v: unknown, lo: number, hi: number, dflt: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
}

export function persistPrefs(prefs: TravelPrefsDto): void {
  try {
    window.localStorage.setItem(PREFS_LS_KEY, JSON.stringify(prefs));
    window.localStorage.setItem(ONBOARDED_LS_KEY, "1");
  } catch { /* best-effort */ }
  void fetch("/api/prefs", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(prefs),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Data for onboarding questions
// ---------------------------------------------------------------------------

const FLIGHT_PREF_OPTIONS = [
  { id: "international", label: "International", desc: "Show me deals to fly abroad" },
  { id: "domestic", label: "Domestic", desc: "Keep it within the US" },
  { id: "both", label: "Both", desc: "Show me everything" },
] as const;

const DISTANCE_PREF_OPTIONS = [
  { id: "farther", label: "Farther is better", desc: "I love long-haul flights and far-flung destinations" },
  { id: "nearby", label: "Keep it close", desc: "Shorter flights, quicker getaways" },
  { id: "no_preference", label: "No preference", desc: "Distance doesn't matter to me" },
] as const;

// Credit card programs (transferable currencies + popular co-brands)
const CARD_PROGRAMS = [
  // Transferable currencies
  { id: "chase_ur", name: "Chase Ultimate Rewards", category: "Credit Card Points", icon: "Chase" },
  { id: "amex_mr", name: "Amex Membership Rewards", category: "Credit Card Points", icon: "Amex" },
  { id: "cap1_miles", name: "Capital One Miles", category: "Credit Card Points", icon: "Cap1" },
  { id: "citi_typ", name: "Citi ThankYou Points", category: "Credit Card Points", icon: "Citi" },
  { id: "bilt", name: "Bilt Rewards", category: "Credit Card Points", icon: "Bilt" },
  { id: "wf_rewards", name: "Wells Fargo Rewards", category: "Credit Card Points", icon: "WF" },
] as const;

const AIRLINE_PROGRAMS = [
  { id: "aeroplan", name: "Air Canada Aeroplan" },
  { id: "delta", name: "Delta SkyMiles" },
  { id: "united", name: "United MileagePlus" },
  { id: "american", name: "AAdvantage" },
  { id: "southwest", name: "Southwest Rapid Rewards" },
  { id: "jetblue", name: "JetBlue TrueBlue" },
  { id: "alaska", name: "Alaska Mileage Plan" },
  { id: "flying_blue", name: "Air France/KLM Flying Blue" },
  { id: "ba_avios", name: "British Airways Avios" },
  { id: "virgin_atlantic", name: "Virgin Atlantic Flying Club" },
  { id: "singapore", name: "Singapore KrisFlyer" },
  { id: "emirates", name: "Emirates Skywards" },
  { id: "cathay", name: "Cathay Pacific Asia Miles" },
  { id: "ana", name: "ANA Mileage Club" },
  { id: "turkish", name: "Turkish Miles&Smiles" },
  { id: "qantas", name: "Qantas Frequent Flyer" },
  { id: "avianca", name: "Avianca LifeMiles" },
  { id: "hawaiian", name: "Hawaiian Airlines HawaiianMiles" },
] as const;

const HOTEL_PROGRAMS = [
  { id: "hyatt", name: "World of Hyatt" },
  { id: "marriott", name: "Marriott Bonvoy" },
  { id: "hilton", name: "Hilton Honors" },
  { id: "ihg", name: "IHG One Rewards" },
  { id: "wyndham", name: "Wyndham Rewards" },
  { id: "accor", name: "Accor Live Limitless" },
] as const;

// ---------------------------------------------------------------------------
// Onboarding data interface
// ---------------------------------------------------------------------------

export interface OnboardingData {
  airports: string[];
  flightPref: "international" | "domestic" | "both";
  distancePref: "farther" | "nearby" | "no_preference";
  loyaltyPrograms: string[];
}

const STEP_LABELS = ["Airports", "Preferences"];
const TOTAL_STEPS = 2;

// Travel style cards — each maps to flightPref + distancePref
const TRAVEL_STYLE_OPTIONS = [
  {
    id: "weekend",
    label: "Weekend getaways",
    desc: "Domestic flights, shorter trips nearby",
    emoji: "🏖️",
    flightPref: "domestic" as const,
    distancePref: "nearby" as const,
  },
  {
    id: "international",
    label: "International adventures",
    desc: "Farther destinations, explore the world",
    emoji: "🌍",
    flightPref: "international" as const,
    distancePref: "farther" as const,
  },
  {
    id: "everything",
    label: "Show me everything",
    desc: "All deals, no filter",
    emoji: "✈️",
    flightPref: "both" as const,
    distancePref: "no_preference" as const,
  },
] as const;

// Top 6 most popular loyalty programs as simple toggle chips
const TOP_PROGRAMS = [
  { id: "chase_ur", label: "Chase UR" },
  { id: "amex_mr", label: "Amex MR" },
  { id: "cap1_miles", label: "Capital One" },
  { id: "delta", label: "Delta SkyMiles" },
  { id: "united", label: "United MileagePlus" },
  { id: "american", label: "AAdvantage" },
] as const;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function OnboardingWizard({
  onComplete,
}: {
  onComplete: (data: OnboardingData) => void;
}) {
  const [step, setStep] = useState(0);
  const [airports, setAirports] = useState<string[]>([]);
  const [travelStyle, setTravelStyle] = useState<string>("everything");
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<string[]>([]);
  const [airportSearch, setAirportSearch] = useState("");
  const [geoSortedAirports, setGeoSortedAirports] = useState<AirportOption[]>(HOME_AIRPORTS);
  const [geoStatus, setGeoStatus] = useState<"pending" | "granted" | "denied">("pending");

  // Derive flightPref + distancePref from travelStyle selection
  const selectedStyle = TRAVEL_STYLE_OPTIONS.find((s) => s.id === travelStyle) ?? TRAVEL_STYLE_OPTIONS[2];
  const flightPref = selectedStyle.flightPref;
  const distancePref = selectedStyle.distancePref;

  // Request geolocation on mount to sort airports by proximity
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const sorted = sortAirportsByDistance(HOME_AIRPORTS, pos.coords.latitude, pos.coords.longitude);
        setGeoSortedAirports(sorted);
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      { timeout: 8000, maximumAge: 300_000 },
    );
  }, []);

  const toggleAirport = (iata: string) => {
    setAirports((cur) =>
      cur.includes(iata) ? cur.filter((a) => a !== iata) : [...cur, iata],
    );
  };

  const toggleProgram = (id: string) => {
    setLoyaltyPrograms((cur) =>
      cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id],
    );
  };

  // Show top 8 airports (geo-sorted if available), or filtered results when searching
  const displayAirports = useMemo(() => {
    const base = geoSortedAirports;
    if (!airportSearch.trim()) return base.slice(0, 8);
    const q = airportSearch.toLowerCase();
    return base.filter(
      (a) =>
        a.iata.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q),
    );
  }, [airportSearch, geoSortedAirports]);

  const finish = async () => {
    const data: OnboardingData = { airports, flightPref, distancePref, loyaltyPrograms };
    // Save to localStorage FIRST for immediate use and as fallback if API fails
    try {
      localStorage.setItem(ONBOARDED_LS_KEY, "1");
      localStorage.setItem("tb_entered", "1");
      localStorage.setItem(
        PREFS_LS_KEY,
        JSON.stringify({
          ...DEFAULT_PREFS,
          homeAirport: airports[0] ?? "MCO",
          preferFarther: distancePref === "farther" || flightPref === "international",
        }),
      );
    } catch {}
    // Save to backend (best-effort, localStorage is the fallback)
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {}
    onComplete(data);
  };

  const nextStep = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else finish();
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const canAdvance =
    step === 0 ? airports.length > 0 : true;

  // Theming locked to AuthModal (HC #651): same card chrome, icon badge header,
  // heading typography, slate-950 surface, amber primary, footer band.
  const stepHeading =
    step === 0
      ? "Where do you fly from?"
      : "What are you looking for?";
  const stepSubtitle =
    step === 0
      ? "Tap the airports you'd depart from."
      : "Pick your travel style, then any points programs.";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[480px] max-h-[92vh] overflow-hidden flex flex-col rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl">
        {/* Header (mirrors AuthModal: icon badge -> heading -> subtitle, centered) */}
        <div className="px-8 pt-8 pb-5 shrink-0">
          <div className="mb-5 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-amber-400 shadow-md ring-1 ring-slate-700">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                <path d="M12 1.5l1.6 6.3 6.3-1.6-4.7 4.7 4.7 4.7-6.3-1.6L12 22.5l-1.6-6.5-6.3 1.6 4.7-4.7-4.7-4.7 6.3 1.6L12 1.5z" />
              </svg>
            </div>
          </div>
          <h2 className="text-center text-[22px] font-bold text-slate-100">{stepHeading}</h2>
          <p className="mt-1 text-center text-sm text-slate-400">{stepSubtitle}</p>
        </div>

        {/* Progress indicator */}
        <div className="px-8 mb-4 shrink-0">
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between">
            {STEP_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`flex items-center gap-1.5 text-[11px] font-medium transition ${
                  i === step
                    ? "text-amber-300"
                    : i < step
                      ? "text-slate-400 cursor-pointer hover:text-slate-200"
                      : "text-slate-600 cursor-default"
                }`}
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    i < step
                      ? "bg-amber-500/20 text-amber-400"
                      : i === step
                        ? "bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/40"
                        : "bg-slate-800 text-slate-600"
                  }`}
                >
                  {i < step ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-8 pb-2 min-h-[280px] overflow-y-auto">
          {/* STEP 1: Airports — top 8 geo-sorted as big tap-friendly buttons */}
          {step === 0 && (
            <div>
              {geoStatus === "granted" && (
                <p className="mb-3 text-[12px] text-amber-300/80">
                  Sorted by distance from you.
                </p>
              )}

              {/* Search (matches AuthModal input chrome) */}
              <input
                className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none"
                placeholder="Search airports (e.g. JFK, Chicago, LAX)..."
                value={airportSearch}
                onChange={(e) => setAirportSearch(e.target.value)}
              />

              {/* Selected badges */}
              {airports.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {airports.map((code) => {
                    const a = HOME_AIRPORTS.find((h) => h.iata === code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleAirport(code)}
                        className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-300 transition hover:bg-amber-500/25"
                      >
                        {code}
                        {a && <span className="text-amber-400/60">({a.city})</span>}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-0.5">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Airport grid — big tap-friendly buttons */}
              <div className="grid grid-cols-2 gap-2">
                {displayAirports.map((a) => {
                  const selected = airports.includes(a.iata);
                  return (
                    <button
                      key={a.iata}
                      type="button"
                      onClick={() => toggleAirport(a.iata)}
                      className={`relative flex flex-col items-start rounded-xl border px-4 py-3.5 text-left transition ${
                        selected
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                          : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60"
                      }`}
                    >
                      <span className="text-base font-bold">{a.iata}</span>
                      <span className="text-xs text-slate-400 truncate w-full">{a.city}</span>
                      {selected && (
                        <span className="absolute top-2.5 right-2.5 text-amber-400">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Travel style + loyalty programs (combined, one screen) */}
          {step === 1 && (
            <div>
              {/* Travel style cards */}
              <div className="space-y-2.5 mb-6">
                {TRAVEL_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTravelStyle(opt.id)}
                    className={`w-full flex items-center gap-4 rounded-xl border px-4 py-4 text-left transition ${
                      travelStyle === opt.id
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-slate-700 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-800/60"
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold ${travelStyle === opt.id ? "text-amber-200" : "text-slate-200"}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
                    </div>
                    {travelStyle === opt.id && (
                      <span className="ml-auto flex-shrink-0 text-amber-400">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Loyalty programs — top 6 as toggle chips */}
              <div>
                <span className="mb-3 block text-[13px] font-semibold text-slate-200">
                  Any points programs?
                </span>
                <div className="flex flex-wrap gap-2">
                  {TOP_PROGRAMS.map((prog) => {
                    const selected = loyaltyPrograms.includes(prog.id);
                    return (
                      <button
                        key={prog.id}
                        type="button"
                        onClick={() => toggleProgram(prog.id)}
                        className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                          selected
                            ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                            : "border-slate-700 bg-slate-900/80 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        {prog.label}
                      </button>
                    );
                  })}
                  {/* None / Skip chip */}
                  <button
                    type="button"
                    onClick={() => setLoyaltyPrograms([])}
                    className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                      loyaltyPrograms.length === 0
                        ? "border-slate-600 bg-slate-800 text-slate-300"
                        : "border-slate-700 bg-slate-900/80 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                    }`}
                  >
                    None / Skip
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer (mirrors AuthModal: border-t band, bg-slate-900/50) */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-800 bg-slate-900/50 px-8 py-4">
          <div />

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
            <button
              type="button"
              onClick={nextStep}
              disabled={!canAdvance}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === TOTAL_STEPS - 1 ? "Start exploring" : "Continue"}
              <span aria-hidden>&#8250;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Legacy export for settings editor compatibility
export function OnboardingModal({
  initial,
  firstVisit,
  onDone,
  onCancel,
  onRestart,
  onApplyTripStyles,
  tripStyles,
}: {
  initial: TravelPrefsDto;
  firstVisit: boolean;
  onDone: (prefs: TravelPrefsDto) => void;
  onCancel?: () => void;
  onRestart?: () => void;
  onApplyTripStyles?: (styles: string[]) => void;
  tripStyles?: string[];
}) {
  // For non-first-visit, show the old compact editor
  const [draft, setDraft] = useState<TravelPrefsDto>(initial);
  const travelIdx = Math.max(0, TRAVEL_STOPS.findIndex((s) => s >= draft.maxTravelHours));
  const [homeDraft, setHomeDraft] = useState<string>(initial.homeAirport || "MCO");
  const homeValid = /^[A-Za-z]{3}$/.test(homeDraft.trim());

  const save = () =>
    onDone({ ...draft, homeAirport: homeValid ? homeDraft.trim().toUpperCase() : draft.homeAirport });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[min(480px,90vw)] max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Travel preferences</h2>
        <p className="text-xs text-slate-400 mb-5">These shape which deals you see. Saved instantly.</p>

        {renderAirportSection(homeDraft, setHomeDraft, homeValid)}
        {renderTravelLimits(draft, setDraft, travelIdx)}

        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="mt-4 text-xs text-slate-500 underline hover:text-slate-300 transition"
          >
            Redo welcome setup
          </button>
        )}
        <div className="mt-5 flex items-center justify-end gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition">
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            Save preferences
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Shared sub-sections (used by legacy editor) ---

const TRAVEL_STOPS = [8, 12, 18, 24, 36, 48];
const fmtTravel = (h: number) => (h >= 48 ? "48h+" : `${h}h`);
const QUICK_AIRPORTS = ["MCO", "MIA", "TPA", "ATL", "JFK", "EWR", "ORD", "DFW", "LAX", "SFO", "SEA", "DEN"];

function renderAirportSection(
  homeDraft: string,
  setHomeDraft: (v: string) => void,
  homeValid: boolean,
) {
  return (
    <div className="mb-4">
      <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
        <span>Your home airport</span>
        <span className="text-amber-400 font-semibold">{homeValid ? homeDraft.trim().toUpperCase() : "\u2014"}</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_AIRPORTS.map((code) => (
          <button
            key={code}
            type="button"
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              homeDraft.trim().toUpperCase() === code
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
            }`}
            onClick={() => setHomeDraft(code)}
          >
            {code}
          </button>
        ))}
        <input
          className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 uppercase placeholder:text-slate-600 focus:border-amber-500/50 outline-none"
          value={QUICK_AIRPORTS.includes(homeDraft.trim().toUpperCase()) ? "" : homeDraft}
          maxLength={3}
          spellCheck={false}
          placeholder="other"
          onChange={(e) => setHomeDraft(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-500">3-letter airport code</div>
    </div>
  );
}

function renderTravelLimits(
  draft: TravelPrefsDto,
  setDraft: (fn: TravelPrefsDto | ((d: TravelPrefsDto) => TravelPrefsDto)) => void,
  travelIdx: number,
) {
  return (
    <div className="space-y-5">
      <div>
        <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
          Longest acceptable travel time, each way?
          <span className="text-amber-400 font-semibold">{fmtTravel(draft.maxTravelHours)}</span>
        </label>
        <input
          type="range"
          min={0}
          max={TRAVEL_STOPS.length - 1}
          step={1}
          value={travelIdx === -1 ? TRAVEL_STOPS.length - 1 : travelIdx}
          onChange={(e) => setDraft({ ...draft, maxTravelHours: TRAVEL_STOPS[Number(e.target.value)] ?? 24 })}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
          {TRAVEL_STOPS.map((s) => <span key={s}>{fmtTravel(s)}</span>)}
        </div>
      </div>

      <div>
        <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
          Longest acceptable layover?
          <span className="text-amber-400 font-semibold">{draft.maxLayoverHours}h</span>
        </label>
        <input
          type="range"
          min={2}
          max={24}
          step={1}
          value={draft.maxLayoverHours}
          onChange={(e) => setDraft({ ...draft, maxLayoverHours: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
          <span>2h</span><span>8h</span><span>16h</span><span>24h</span>
        </div>
      </div>

      <div>
        <span className="text-xs font-medium text-slate-300">Cabin preference?</span>
        <div className="mt-2 flex gap-2">
          {(["economy", "premium", "any"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                draft.cabin === c
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
              }`}
              onClick={() => setDraft({ ...draft, cabin: c })}
            >
              {c === "any" ? "don't care" : c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-medium text-slate-300">Nonstop flights only?</span>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              draft.nonstopOnly
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
            }`}
            onClick={() => setDraft({ ...draft, nonstopOnly: true })}
          >
            Nonstop only
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              !draft.nonstopOnly
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
            }`}
            onClick={() => setDraft({ ...draft, nonstopOnly: false })}
          >
            Connections are fine
          </button>
        </div>
      </div>
    </div>
  );
}
