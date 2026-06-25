"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserSettings } from "@/lib/settings";
import {
  isUsState,
  loadCountryOptions,
  loadStateOptions,
  passportTogglePatch,
  type RegionOption,
} from "@/lib/regions";

interface PassportPanelProps {
  visitedRegions: string[];
  usaAsStates: boolean;
  /** Patches settings (visitedRegions, and auto usaAsStates once split). */
  onSettingsChange: (patch: Partial<UserSettings>) => void;
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
        checked ? "bg-teal-500/10 text-teal-100" : "text-slate-300 hover:bg-slate-800/70"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
          checked ? "border-teal-400 bg-teal-400 text-slate-950" : "border-slate-600"
        }`}
      >
        {checked && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function Section({
  title,
  count,
  total,
  open,
  onToggleOpen,
  children,
}: {
  title: string;
  count: number;
  total: number;
  open: boolean;
  onToggleOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-800/80">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-200"
      >
        <span>
          {title}{" "}
          {count > 0 && <span className="ml-1 text-teal-400 normal-case tracking-normal">({count})</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-slate-600">{total}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && <div className="pb-1.5">{children}</div>}
    </div>
  );
}

export default function PassportPanel({
  visitedRegions,
  usaAsStates,
  onSettingsChange,
}: PassportPanelProps) {
  const [countries, setCountries] = useState<RegionOption[]>([]);
  const [states, setStates] = useState<RegionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openCountries, setOpenCountries] = useState(true);
  const [openStates, setOpenStates] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadCountryOptions(), loadStateOptions()])
      .then(([c, s]) => {
        if (!alive) return;
        setCountries(c);
        setStates(s);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const visited = useMemo(
    () => new Set(visitedRegions.map((c) => c.toUpperCase())),
    [visitedRegions],
  );
  const countryCount = visitedRegions.filter((c) => !isUsState(c)).length;
  const stateCount = visitedRegions.filter(isUsState).length;

  const q = query.trim().toLowerCase();
  const filteredCountries = useMemo(
    () => (q ? countries.filter((o) => o.name.toLowerCase().includes(q)) : countries),
    [countries, q],
  );
  const filteredStates = useMemo(
    () => (q ? states.filter((o) => o.name.toLowerCase().includes(q)) : states),
    [states, q],
  );

  const toggle = (code: string) => {
    onSettingsChange(passportTogglePatch(visitedRegions, code, usaAsStates));
  };

  // While searching, force both groups open so matches are reachable.
  const showCountries = q ? filteredCountries.length > 0 : openCountries;
  const showStates = q ? filteredStates.length > 0 : openStates;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2 pt-1">
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-teal-300">{countryCount}</span>{" "}
          {countryCount === 1 ? "country" : "countries"} ·{" "}
          <span className="font-semibold text-teal-300">{stateCount}</span>{" "}
          {stateCount === 1 ? "state" : "states"}
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Double Click or Search to Add"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-teal-500/60 focus:outline-none"
        />
      </div>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-4 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <Section
              title="Countries"
              count={countryCount}
              total={countries.length}
              open={showCountries}
              onToggleOpen={() => setOpenCountries((v) => !v)}
            >
              <ul className="space-y-0.5 px-1.5">
                {filteredCountries.map((o) => (
                  <li key={o.code}>
                    <CheckRow label={o.name} checked={visited.has(o.code)} onToggle={() => toggle(o.code)} />
                  </li>
                ))}
                {filteredCountries.length === 0 && (
                  <li className="px-3 py-2 text-xs text-slate-500">No matches.</li>
                )}
              </ul>
            </Section>
            <Section
              title="US States"
              count={stateCount}
              total={states.length}
              open={showStates}
              onToggleOpen={() => setOpenStates((v) => !v)}
            >
              <ul className="space-y-0.5 px-1.5">
                {filteredStates.map((o) => (
                  <li key={o.code}>
                    <CheckRow label={o.name} checked={visited.has(o.code)} onToggle={() => toggle(o.code)} />
                  </li>
                ))}
                {filteredStates.length === 0 && (
                  <li className="px-3 py-2 text-xs text-slate-500">No matches.</li>
                )}
              </ul>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
