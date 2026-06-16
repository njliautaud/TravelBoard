"use client";

import { useMemo, useState } from "react";
import { isInSeason, sortBySeason } from "@/lib/season";
import type { LocationItem } from "@/lib/types";
import type { UserSettings } from "@/lib/settings";
import SettingsPanel from "./SettingsPanel";

export type SidebarView = "wishes" | "settings";

interface SidebarProps {
  locations: LocationItem[];
  editor: boolean;
  /** Drawer open state */
  open: boolean;
  settings: UserSettings;
  settingsSaving: boolean;
  onClose: () => void;
  onAddPlace: () => void;
  onSelectWish: (loc: LocationItem) => void;
  onToggleStar: (loc: LocationItem) => void;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
}

function reminderDueSoon(loc: LocationItem): boolean {
  if (!loc.reminderAt) return false;
  return (new Date(loc.reminderAt).getTime() - Date.now()) / 86_400_000 <= 60;
}

function StarButton({
  starred,
  editor,
  onToggle,
}: {
  starred: boolean;
  editor: boolean;
  onToggle: () => void;
}) {
  if (!editor && !starred) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (editor) onToggle();
      }}
      aria-label={starred ? "Unstar wish" : "Star wish"}
      title={editor ? (starred ? "Unstar" : "Star to pin to top") : "Starred"}
      className={`mt-0.5 shrink-0 rounded p-0.5 transition ${
        editor ? "hover:bg-slate-700/80" : "cursor-default"
      } ${starred ? "text-amber-400" : "text-slate-600 hover:text-amber-400/80"}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={starred ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}

export default function Sidebar({
  locations,
  editor,
  open,
  settings,
  settingsSaving,
  onClose,
  onAddPlace,
  onSelectWish,
  onToggleStar,
  onSettingsChange,
}: SidebarProps) {
  const [view, setView] = useState<SidebarView>("wishes");
  const sorted = useMemo(() => sortBySeason(locations), [locations]);
  const starredCount = sorted.filter((l) => l.starred).length;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-slate-800/60 bg-slate-950/[0.97] backdrop-blur-xl transition-transform duration-300 ease-out sm:left-16
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-800/60 p-4">
          <h1 className="text-base font-bold tracking-wide text-amber-300 glow-text">TravelBoard</h1>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-slate-800/60 px-3 py-2">
          <div className="flex gap-1">
            <button
              onClick={() => setView("wishes")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                view === "wishes"
                  ? "bg-amber-500/15 text-amber-300"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              Wishes ({locations.length})
            </button>
            <button
              onClick={() => setView("settings")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                view === "settings"
                  ? "bg-amber-500/15 text-amber-300"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {view === "wishes" ? (
          <>
            <div className="p-3">
              <button
                onClick={onAddPlace}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:from-amber-400 hover:to-amber-500"
              >
                + Add place
              </button>
            </div>

            <p className="px-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {starredCount > 0 ? "Starred first" : "In season first"}
            </p>

            <nav className="panel-scroll flex-1 overflow-y-auto px-2 pb-3">
              {sorted.length === 0 && (
                <p className="px-2 pt-2 text-sm text-slate-500">No places yet. Add your first wish!</p>
              )}
              <ul className="space-y-0.5">
                {sorted.map((loc) => {
                  const inSeason = isInSeason(loc) && loc.status !== "VISITED";
                  const due = reminderDueSoon(loc);
                  return (
                    <li key={loc.id}>
                      <button
                        onClick={() => onSelectWish(loc)}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-800/70 ${
                          loc.starred ? "bg-amber-500/5" : ""
                        }`}
                      >
                        <StarButton
                          starred={loc.starred}
                          editor={editor}
                          onToggle={() => onToggleStar(loc)}
                        />
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            loc.isDeal
                              ? "bg-rose-400 deal-pulse"
                              : loc.status === "VISITED"
                                ? "bg-emerald-400"
                                : "bg-amber-400"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-200 group-hover:text-white">
                            {loc.activityName}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {[loc.city, loc.countryName].filter(Boolean).join(", ")}
                          </span>
                          {(loc.isDeal || due || inSeason) && (
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              {loc.isDeal && loc.latestPrice && (
                                <span className="rounded-full bg-rose-500/15 px-1.5 py-px text-[10px] font-medium text-rose-300">
                                  deal {loc.latestPrice.currency} {loc.latestPrice.price.toFixed(0)}
                                </span>
                              )}
                              {due && (
                                <span className="rounded-full bg-violet-500/15 px-1.5 py-px text-[10px] font-medium text-violet-300">
                                  reminder due
                                </span>
                              )}
                              {inSeason && (
                                <span className="rounded-full bg-sky-500/15 px-1.5 py-px text-[10px] font-medium text-sky-300">
                                  in season
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </>
        ) : editor ? (
          <SettingsPanel settings={settings} saving={settingsSaving} onChange={onSettingsChange} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <p className="text-sm text-slate-400">Log in to change theme and home airports.</p>
          </div>
        )}
      </aside>
    </>
  );
}
