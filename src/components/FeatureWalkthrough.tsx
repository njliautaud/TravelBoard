"use client";

/**
 * Phase 4 — Feature Walkthrough (onboarding tour).
 * Step-by-step overlay highlighting key features for first-time users.
 */

import { useCallback, useEffect, useState } from "react";

interface WalkthroughStep {
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const STEPS: WalkthroughStep[] = [
  {
    target: "[data-testid='hero-search-input']",
    title: "Search for flights",
    description: "Type any city, country, or airport code to find deals. The full search shows cash and points options side by side.",
    position: "bottom",
  },
  {
    target: "[data-testid='scope-row']",
    title: "Filter by region",
    description: "Toggle between Everywhere, USA, and International deals to focus on what interests you.",
    position: "bottom",
  },
  {
    target: ".deals-grid",
    title: "Deal cards",
    description: "Click any deal card for detailed pricing, airline info, price history, and booking links. Cards are ranked by deal quality.",
    position: "left",
  },
  {
    target: "[data-testid='nav-tools']",
    title: "All tools",
    description: "Open the tools drawer for trip planner, lounge finder, savings, points optimizer, travel journal, data export, and more.",
    position: "left",
  },
  {
    target: "[data-testid='nav-map']",
    title: "Interactive map",
    description: "Explore deals geographically. Click destinations on the map to see pricing and book directly.",
    position: "right",
  },
];

const LS_KEY = "travelboard.walkthrough_done";

export function useWalkthroughState() {
  const [active, setActive] = useState(false);

  const shouldShow = (() => {
    try {
      return !localStorage.getItem(LS_KEY);
    } catch {
      return false;
    }
  })();

  const startWalkthrough = useCallback(() => setActive(true), []);
  const dismissWalkthrough = useCallback(() => {
    setActive(false);
    try { localStorage.setItem(LS_KEY, "1"); } catch {}
  }, []);

  return { shouldShow, startWalkthrough, dismissWalkthrough, walkthroughActive: active };
}

export default function FeatureWalkthrough({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  const current = STEPS[step];

  useEffect(() => {
    if (!current) return;
    const el =
      document.querySelector(current.target) ??
      document.querySelector(`[data-testid="${current.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setHighlight(rect);
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      setHighlight(null);
    }
  }, [step, current]);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onComplete();
  }, [step, onComplete]);

  const prev = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onComplete]);

  if (!current) return null;

  // Tooltip positioning
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 10002,
    maxWidth: 320,
  };

  if (highlight) {
    const margin = 16;
    switch (current.position) {
      case "bottom":
        tooltipStyle.top = highlight.bottom + margin;
        tooltipStyle.left = Math.max(16, Math.min(window.innerWidth - 340, highlight.left));
        break;
      case "top":
        tooltipStyle.bottom = window.innerHeight - highlight.top + margin;
        tooltipStyle.left = Math.max(16, Math.min(window.innerWidth - 340, highlight.left));
        break;
      case "left":
        tooltipStyle.top = Math.max(16, highlight.top);
        tooltipStyle.right = window.innerWidth - highlight.left + margin;
        break;
      case "right":
        tooltipStyle.top = Math.max(16, highlight.top);
        tooltipStyle.left = highlight.right + margin;
        break;
    }
  } else {
    tooltipStyle.top = "50%";
    tooltipStyle.left = "50%";
    tooltipStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm"
        onClick={onComplete}
        role="presentation"
        aria-hidden="true"
      />

      {/* Highlight ring */}
      {highlight && (
        <div
          className="fixed z-[10001] rounded-xl border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none"
          style={{
            top: highlight.top - 4,
            left: highlight.left - 4,
            width: highlight.width + 8,
            height: highlight.height + 8,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip */}
      <div
        style={tooltipStyle}
        className="rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-lg"
        role="dialog"
        aria-modal="true"
        aria-label={`Step ${step + 1} of ${STEPS.length}: ${current.title}`}
      >
        <p className="mb-1 text-xs font-semibold text-amber-400">
          {step + 1} / {STEPS.length}
        </p>
        <h3 className="mb-2 text-base font-bold text-slate-100">{current.title}</h3>
        <p className="mb-4 text-sm leading-relaxed text-slate-400">{current.description}</p>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onComplete}
            className="text-xs text-slate-500 transition hover:text-slate-300"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prev}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
            >
              {step === STEPS.length - 1 ? "Got it!" : "Next"}
            </button>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="mt-3 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-4 bg-amber-400"
                  : i < step
                  ? "w-1.5 bg-amber-600"
                  : "w-1.5 bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
