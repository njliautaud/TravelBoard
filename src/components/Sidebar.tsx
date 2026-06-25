"use client";

import { useMemo } from "react";
import { isInSeason, sortBySeason } from "@/lib/season";
import type { LocationItem, Panel, StatusFilter, UserProfile } from "@/lib/types";
import type { UserSettings } from "@/lib/settings";
import SettingsPanel from "./SettingsPanel";
import FriendsTab from "./FriendsTab";
import PassportPanel from "./PassportPanel";
import { NAV_PILLARS, NavIcon } from "./navConfig";

interface SidebarProps {
  locations: LocationItem[];
  /** True only when looking at your own board (controls wish editing). */
  editor: boolean;
  /** True whenever a user is logged in (controls Settings access). */
  loggedIn: boolean;
  /** Mobile drawer state; ignored on sm+ where the sidebar is permanent */
  open: boolean;
  settings: UserSettings;
  settingsSaving: boolean;
  /** Shared wished/visited/all filter (single source of truth with the map toggle). */
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  /** Active section, lifted so the bottom-center selector can drive it too. */
  panel: Panel;
  onPanelChange: (panel: Panel) => void;
  /** The friend's board you're viewing now (null = your own). */
  viewedUser: UserProfile | null;
  /** Bumped by the parent to force the Friends tab to refetch (e.g. after an inbox accept). */
  friendsRefresh: number;
  /** Friends list changed in the tab — let the parent refresh the inbox badge. */
  onFriendsChanged: () => void;
  onSelectProfile: (profile: UserProfile | null) => void;
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
  loggedIn,
  open,
  settings,
  settingsSaving,
  statusFilter,
  onStatusFilterChange,
  panel,
  onPanelChange,
  viewedUser,
  friendsRefresh,
  onFriendsChanged,
  onSelectProfile,
  onClose,
  onAddPlace,
  onSelectWish,
  onToggleStar,
  onSettingsChange,
}: SidebarProps) {
  const sorted = useMemo(() => sortBySeason(locations), [locations]);

  // The list mirrors the shared filter: Wished = to-visit, Visited = visited, World = everything.
  const listed = useMemo(() => {
    if (statusFilter === "wished") return sorted.filter((l) => l.status === "TO_VISIT");
    if (statusFilter === "visited") return sorted.filter((l) => l.status === "VISITED");
    return sorted;
  }, [sorted, statusFilter]);
  const starredCount = listed.filter((l) => l.starred).length;

  const ownHeading =
    statusFilter === "wished" ? "Wishes" : statusFilter === "visited" ? "Visited" : "All places";
  const friendNoun =
    statusFilter === "wished" ? "wishes" : statusFilter === "visited" ? "visited" : "places";
  const listHeading = viewedUser ? `${viewedUser.username}'s ${friendNoun}` : ownHeading;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 sm:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-x-0 bottom-16 z-40 flex h-[70vh] w-full flex-col rounded-t-2xl border-t border-slate-800 bg-slate-950/97 backdrop-blur transition-transform duration-300
          sm:static sm:inset-auto sm:bottom-auto sm:h-auto sm:w-72 sm:shrink-0 sm:rounded-none sm:border-r sm:border-t-0 sm:bg-slate-950 sm:backdrop-blur-none
          ${open ? "translate-y-0" : "translate-y-full"} sm:translate-y-0`}
      >
        {/* Grab handle (mobile bottom sheet) */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-700 sm:hidden" />

        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <h1 className="text-base font-bold tracking-wide text-amber-300 glow-text">TravelBoard</h1>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 sm:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Edge-dock nav — always-visible pillars (desktop). Mobile uses BottomNav. */}
        <nav className="hidden border-b border-slate-800 py-2 sm:block">
          {NAV_PILLARS.filter((p) => editor || p.panel !== "passport").map((item) => {
            const active = panel === item.panel;
            const isTeal = item.accent === "teal";
            return (
              <button
                key={item.panel}
                onClick={() => onPanelChange(item.panel)}
                aria-current={active ? "page" : undefined}
                className={`relative flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? isTeal
                      ? "bg-teal-500/10 text-teal-200"
                      : "bg-amber-500/10 text-amber-200"
                    : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                }`}
              >
                {active && (
                  <span
                    className={`absolute left-0 top-0 h-full w-0.5 ${isTeal ? "bg-teal-400" : "bg-amber-400"}`}
                  />
                )}
                <NavIcon panel={item.panel} size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {viewedUser && (
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-amber-500/5 px-4 py-2 text-xs">
            <span className="min-w-0 truncate text-amber-200/90">
              Viewing <b className="font-semibold">{viewedUser.username}</b> · read-only
            </span>
            <button
              onClick={() => onSelectProfile(null)}
              className="shrink-0 text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              Your board
            </button>
          </div>
        )}

        {panel === "passport" ? (
          !loggedIn ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <p className="text-sm text-slate-400">Log in to build your passport.</p>
            </div>
          ) : !editor ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <p className="text-sm text-slate-400">
                You can only edit your own passport. Switch back to your board to add visited
                countries and states.
              </p>
            </div>
          ) : (
            <>
              <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Passport <span className="text-slate-600">— where you&apos;ve been</span>
              </p>
              <PassportPanel
                visitedRegions={settings.visitedRegions}
                usaAsStates={settings.usaAsStates}
                onSettingsChange={onSettingsChange}
              />
            </>
          )
        ) : panel === "friends" ? (
          loggedIn ? (
            <FriendsTab
              refreshKey={friendsRefresh}
              onChanged={onFriendsChanged}
              onSelectProfile={(friend) => {
                onSelectProfile(friend);
                onClose();
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <p className="text-sm text-slate-400">Log in to add friends.</p>
            </div>
          )
        ) : panel === "flights" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-slate-300">Flight Tracker</p>
            <p className="text-xs text-slate-500">
              Price tracking and deal alerts for your wishes are coming here soon.
            </p>
          </div>
        ) : panel === "settings" ? (
          loggedIn ? (
            <SettingsPanel settings={settings} saving={settingsSaving} onChange={onSettingsChange} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <p className="text-sm text-slate-400">Log in to change theme and home airports.</p>
            </div>
          )
        ) : (
          <>
            {editor && (
              <div className="p-3">
                <button
                  onClick={onAddPlace}
                  className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-400"
                >
                  + Add place
                </button>
              </div>
            )}

            {/* World / Wished / Visited — the journal's sub-categories, synced with
                the bottom-center map toggle. */}
            <div className="px-3 pb-2">
              <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 p-1 text-xs">
                {([
                  ["world", "World"],
                  ["wished", "Wished"],
                  ["visited", "Visited"],
                ] as const).map(([key, label]) => {
                  const active = key === "world" ? statusFilter === "all" : statusFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onStatusFilterChange(key === "world" ? "all" : key)}
                      className={`flex-1 rounded-full px-2 py-1 font-medium transition ${
                        active
                          ? key === "visited"
                            ? "bg-emerald-500/90 text-slate-950"
                            : "bg-amber-500/90 text-slate-950"
                          : "text-slate-300 hover:text-amber-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="px-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {listHeading}{" "}
              <span className="text-slate-600">
                — {starredCount > 0 ? "starred first" : "in season first"}
              </span>
            </p>

            <nav className="panel-scroll flex-1 overflow-y-auto px-2 pb-3">
              {listed.length === 0 && (
                <p className="px-2 pt-2 text-sm text-slate-500">
                  {viewedUser
                    ? `${viewedUser.username} has no ${friendNoun} yet.`
                    : statusFilter === "visited"
                      ? "No visited places yet."
                      : "No places yet. Add your first wish!"}
                </p>
              )}
              <ul className="space-y-0.5">
                {listed.map((loc) => {
                  const inSeason = isInSeason(loc) && loc.status !== "VISITED";
                  const due = reminderDueSoon(loc);
                  return (
                    <li key={loc.id}>
                      {/* A div (not a button) so the inner StarButton isn't an
                          invalid nested <button> — that caused a hydration error. */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectWish(loc)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectWish(loc);
                          }
                        }}
                        className={`group flex w-full cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-800/70 ${
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
                      </div>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </>
        )}
      </aside>
    </>
  );
}
