"use client";

/**
 * Onboarding wizard - shown on first visit to collect travel preferences.
 * 4-step wizard: Home airport, Trip styles, Points & miles, Preferences.
 * Also doubles as a preferences editor (compact modal, all at once).
 */

import { useEffect, useMemo, useState } from "react";

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

const TRAVEL_STOPS = [8, 12, 18, 24, 36, 48];
const fmtTravel = (h: number) => (h >= 48 ? "48h+" : `${h}h`);

const QUICK_AIRPORTS = ["MCO", "MIA", "TPA", "ATL", "JFK", "EWR", "ORD", "DFW", "LAX", "SFO", "SEA", "DEN"];

const TRIP_STYLES: Array<{ id: string; label: string; icon: string }> = [
  { id: "beach", label: "Beach & islands", icon: "\u{1F3D6}" },
  { id: "city", label: "Cities & culture", icon: "\u{1F3D9}" },
  { id: "food", label: "Food trips", icon: "\u{1F35C}" },
  { id: "nature", label: "Nature & adventure", icon: "\u{1F3DE}" },
  { id: "ski", label: "Snow & ski", icon: "\u26F7" },
];

const STEP_LABELS = ["Home airport", "Travel style", "Points & miles", "Preferences"];
const TOTAL_STEPS = 4;

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
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<TravelPrefsDto>(initial);
  const travelIdx = Math.max(0, TRAVEL_STOPS.findIndex((s) => s >= draft.maxTravelHours));

  // --- A. home airport ---
  const [homeDraft, setHomeDraft] = useState<string>(initial.homeAirport || "MCO");
  const homeValid = /^[A-Za-z]{3}$/.test(homeDraft.trim());

  // --- B. trip styles ---
  const [styles, setStyles] = useState<string[]>(tripStyles ?? []);
  const toggleStyle = (id: string) =>
    setStyles((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));

  const finish = (prefs: TravelPrefsDto, _how: "saved" | "skipped") => {
    if (firstVisit && _how === "saved") {
      onApplyTripStyles?.(styles);
    }
    onDone(prefs);
  };

  const save = () =>
    finish({ ...draft, homeAirport: homeValid ? homeDraft.trim().toUpperCase() : draft.homeAirport }, "saved");

  const nextStep = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else save();
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  // For non-firstVisit (editor mode), show everything at once.
  if (!firstVisit) {
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

  // === WIZARD MODE (firstVisit) ===
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-[min(520px,92vw)] max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        {/* Hero branding */}
        <div className="px-6 pt-8 pb-4 text-center">
          <div className="text-2xl font-extrabold tracking-widest text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            TRAVELBOARD
          </div>
          <div className="mt-1 text-sm text-slate-400">Your radar for real vacations</div>
        </div>

        {/* Progress indicator */}
        <div className="px-6 mb-4">
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
        <div className="px-6 pb-2 min-h-[260px]">
          {step === 0 && (
            <div>
              <h3 className="text-base font-bold text-slate-100 mb-1">Where do you fly from?</h3>
              <p className="text-xs text-slate-400 mb-4">Every deal is priced as a round trip from here</p>
              {renderAirportSection(homeDraft, setHomeDraft, homeValid)}
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="text-base font-bold text-slate-100 mb-1">What kind of trips are you after?</h3>
              <p className="text-xs text-slate-400 mb-4">Pick none to see everything -- this just orders the board</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TRIP_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`relative flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm transition ${
                      styles.includes(s.id)
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                        : "border-slate-700/60 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60"
                    }`}
                    onClick={() => toggleStyle(s.id)}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-xs font-medium">{s.label}</span>
                    {styles.includes(s.id) && (
                      <span className="absolute top-1.5 right-1.5 text-amber-400">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <span className="text-xs font-medium text-slate-300">
                  Show more international / long-haul deals?
                </span>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      draft.preferFarther
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                    }`}
                    onClick={() => setDraft({ ...draft, preferFarther: true })}
                  >
                    Yes -- float vacations to top
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      !draft.preferFarther
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                    }`}
                    onClick={() => setDraft({ ...draft, preferFarther: false })}
                  >
                    No -- home-region first
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-base font-bold text-slate-100 mb-1">Which points do you collect?</h3>
              <p className="text-xs text-slate-400 mb-4">You can add points programs later from the Points panel.</p>
              <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-6 text-center">
                <p className="text-sm text-slate-400">
                  Points program setup is available in the Tools panel after onboarding.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-base font-bold text-slate-100 mb-1">Fine-tune your preferences</h3>
              <p className="text-xs text-slate-400 mb-4">All changeable any time from the settings</p>
              {renderTravelLimits(draft, setDraft, travelIdx)}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={() => finish(DEFAULT_PREFS, "skipped")}
            className="text-xs text-slate-500 hover:text-slate-300 transition"
            title="Use sensible defaults (Orlando, 24h travel, 8h layovers, economy)"
          >
            Skip setup
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
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
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              {step === TOTAL_STEPS - 1 ? "Start exploring" : "Continue"}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Shared sub-sections ---

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
      {/* Max travel time */}
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

      {/* Max layover */}
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

      {/* Layover day trip */}
      <div>
        <span className="text-xs font-medium text-slate-300">Long layover = bonus mini day trip?</span>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              draft.layoverDayTrip
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
            }`}
            onClick={() => setDraft({ ...draft, layoverDayTrip: true })}
          >
            Yes -- show as a feature
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              !draft.layoverDayTrip
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
            }`}
            onClick={() => setDraft({ ...draft, layoverDayTrip: false })}
          >
            No -- hide long layovers
          </button>
        </div>
      </div>

      {/* Cabin preference */}
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

      {/* Nonstop only */}
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
