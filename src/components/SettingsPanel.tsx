"use client";

import { useMemo, useState } from "react";
import { HOME_AIRPORTS } from "@/lib/airports";
import type { MapTheme, UserSettings } from "@/lib/settings";

interface SettingsPanelProps {
  settings: UserSettings;
  saving: boolean;
  onChange: (patch: Partial<UserSettings>) => void;
}

const THEMES: { id: MapTheme; label: string; description: string }[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Dark map with amber country glow — the original TravelBoard look.",
  },
  {
    id: "flag",
    label: "Flag colors",
    description: "Each country's heatmap and border glow uses its flag accent color.",
  },
];

export default function SettingsPanel({ settings, saving, onChange }: SettingsPanelProps) {
  const [airportQuery, setAirportQuery] = useState("");

  const filteredAirports = useMemo(() => {
    const q = airportQuery.trim().toLowerCase();
    if (!q) return HOME_AIRPORTS;
    return HOME_AIRPORTS.filter(
      (a) =>
        a.iata.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q)
    );
  }, [airportQuery]);

  const toggleAirport = (iata: string) => {
    const set = new Set(settings.homeAirports);
    if (set.has(iata)) set.delete(iata);
    else set.add(iata);
    onChange({ homeAirports: [...set].sort() });
  };

  return (
    <div className="panel-scroll flex-1 overflow-y-auto px-3 pb-4">
      <section className="mb-6">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Theme</h2>
        <p className="mb-3 text-xs text-slate-500">How countries glow on the map.</p>
        <div className="space-y-2">
          {THEMES.map((t) => {
            const active = settings.mapTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange({ mapTheme: t.id })}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-amber-500/60 bg-amber-500/15"
                    : "border-slate-700 bg-slate-900/60 hover:border-slate-600"
                }`}
              >
                <span className={`block text-sm font-medium ${active ? "text-amber-200" : "text-slate-200"}`}>
                  {t.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{t.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">United States</h2>
        <p className="mb-3 text-xs text-slate-500">
          How US wishes group on the map. Showing each state separately stops a busy USA
          from clogging into one country — every state becomes its own clickable unit.
        </p>
        <div className="space-y-2">
          {([
            [false, "One country", "All US wishes group under the United States."],
            [true, "By state", "Each state is its own map unit, with its own wishes."],
          ] as const).map(([value, label, description]) => {
            const active = settings.usaAsStates === value;
            return (
              <button
                key={label}
                type="button"
                onClick={() => onChange({ usaAsStates: value })}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-amber-500/60 bg-amber-500/15"
                    : "border-slate-700 bg-slate-900/60 hover:border-slate-600"
                }`}
              >
                <span className={`block text-sm font-medium ${active ? "text-amber-200" : "text-slate-200"}`}>
                  {label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Home airports</h2>
        <p className="mb-3 text-xs text-slate-500">
          Airports you fly out of — used for flight deal tracking.
          {settings.homeAirports.length > 0 && (
            <span className="text-amber-400/90"> {settings.homeAirports.length} selected</span>
          )}
        </p>
        <input
          value={airportQuery}
          onChange={(e) => setAirportQuery(e.target.value)}
          placeholder="Search by code, city, or name…"
          className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
        />
        <ul className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-1">
          {filteredAirports.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-slate-500">No airports match</li>
          )}
          {filteredAirports.map((a) => {
            const checked = settings.homeAirports.includes(a.iata);
            return (
              <li key={a.iata}>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-800/60 ${
                    checked ? "bg-amber-500/5" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAirport(a.iata)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-200">
                      <span className="font-mono font-medium text-amber-300/90">{a.iata}</span>
                      {" · "}
                      {a.city}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {a.name} — {a.country}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Notifications */}
      <section className="mt-6">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Notifications
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Get notified about price drops and deal alerts.
        </p>
        <div className="space-y-2">
          {/* Push notifications coming soon */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-slate-200">
                  Push notifications
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Browser push alerts for price drops and deal matches.
                </span>
              </div>
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                Coming soon
              </span>
            </div>
          </div>

          {/* Email digest — functional placeholder */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-slate-200">
                  Email digest
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Weekly summary of deals from your home airports.
                </span>
              </div>
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                Coming soon
              </span>
            </div>
          </div>

          {/* Deal alerts */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-slate-200">
                  Price watch alerts
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Get alerted when watched routes drop below your target price.
                </span>
              </div>
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </section>

      {saving && <p className="mt-3 text-center text-[11px] text-slate-500">Saving…</p>}
    </div>
  );
}
