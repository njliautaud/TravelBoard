"use client";

import { useState } from "react";
import type { UserSettings } from "@/lib/settings";
import PassportPanel from "./PassportPanel";

interface PassportOnboardingProps {
  open: boolean;
  settings: UserSettings;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
  /** Mark onboarding finished/skipped (one-shot) and close. */
  onFinish: () => void;
}

export default function PassportOnboarding({
  open,
  settings,
  onSettingsChange,
  onFinish,
}: PassportOnboardingProps) {
  const [step, setStep] = useState<"welcome" | "pick">("welcome");
  if (!open) return null;

  if (step === "welcome") {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
        <div className="max-w-sm rounded-2xl border border-slate-700/70 bg-slate-950/95 p-6 text-center shadow-2xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/15 text-2xl">
            🧭
          </div>
          <h2 className="text-lg font-bold text-slate-100">Welcome to TravelBoard</h2>
          <p className="mt-2 text-sm text-slate-400">
            Before you add wishes, light up the world. Mark every country and US state
            you’ve already been to — your map glows to show your story so far.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={() => setStep("pick")}
              className="rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-teal-400"
            >
              Map out where you’ve been
            </button>
            <button
              onClick={onFinish}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pick step: a docked panel that leaves the map visible so regions light up live.
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-end sm:items-stretch">
      <div className="pointer-events-auto flex h-[60vh] w-full flex-col border-t border-slate-700/70 bg-slate-950/97 shadow-2xl backdrop-blur sm:h-full sm:w-80 sm:border-r sm:border-t-0">
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 p-4">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Where have you been?</h2>
            <p className="mt-0.5 text-xs text-slate-500">Tap to light up the map. Save anytime.</p>
          </div>
          <button
            onClick={onFinish}
            className="shrink-0 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
          >
            Done
          </button>
        </div>
        <PassportPanel
          visitedRegions={settings.visitedRegions}
          usaAsStates={settings.usaAsStates}
          onSettingsChange={onSettingsChange}
        />
      </div>
    </div>
  );
}
