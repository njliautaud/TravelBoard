"use client";

import { useMemo, useState } from "react";
import { isInSeason, sortBySeason } from "@/lib/season";
import type { LocationItem, StatusFilter, UserProfile } from "@/lib/types";
import type { UserSettings } from "@/lib/settings";
import SettingsPanel from "./SettingsPanel";
import FriendsTab from "./FriendsTab";

/** Which area the sidebar body shows. The list's wished/visited/all filter is
 *  NOT a panel — it's the shared `statusFilter` (synced with the map toggle). */
type Panel = "list" | "friends" | "settings";

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
  /** Reset the map to the world view (the "World" dropdown option). */
  onResetWorld: () => void;
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
  viewedUser,
  friendsRefresh,
  onFriendsChanged,
  onSelectProfile,
  onClose,
  onAddPlace,
  onSelectWish,
  onToggleStar,
  onSettingsChange,
  onResetWorld,
}: SidebarProps) {
  const [panel, setPanel] = useState<Panel>("list");
  // Bumped on the one-shot "World" pick so the component re-renders and the
  // controlled <select> snaps back (otherwise picking it again fires no onChange).
  const [, bumpSelect] = useState(0);
  const sorted = useMemo(() => sortBySeason(locations), [locations]);

  // The list mirrors the shared filter: Wished = to-visit, Visited = visited, All = everything.
  const listed = useMemo(() => {
    if (statusFilter === "wished") return sorted.filter((l) => l.status === "TO_VISIT");
    if (statusFilter === "visited") return sorted.filter((l) => l.status === "VISITED");
    return sorted;
  }, [sorted, statusFilter]);
  const starredCount = listed.filter((l) => l.starred).length;

  // The <select> shows the panel when on Friends/Settings, else the shared filter.
  // "World" doubles as the all-places state here (it also recenters the map), so
  // there's no separate "All" option — show World whenever the filter is "all".
  const dropdownValue =
    panel !== "list" ? panel : statusFilter === "all" ? "world" : statusFilter;

  const handleViewChange = (value: string) => {
    if (value === "world") {
      // One-shot: reset the map (also resets the shared filter to "all" in the parent).
      onResetWorld();
      onClose();
      setPanel("list");
      bumpSelect((n) => n + 1);
      return;
    }
    if (value === "friends" || value === "settings") {
      setPanel(value);
      return;
    }
    // all | wished | visited — the shared filter (and back to the list panel).
    setPanel("list");
    onStatusFilterChange(value as StatusFilter);
  };

  const ownHeading =
    statusFilter === "wished" ? "Wishes" : statusFilter === "visited" ? "Visited" : "All places";
  const friendNoun =
    statusFilter === "wished" ? "wishes" : statusFilter === "visited" ? "visited" : "places";
  const listHeading = viewedUser ? `${viewedUser.username}'s ${friendNoun}` : ownHeading;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm sm:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950/95 backdrop-blur transition-transform duration-300
          sm:static sm:z-auto sm:translate-x-0 sm:bg-slate-950 sm:backdrop-blur-none
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <h1 className="text-base font-bold tracking-wide text-amber-300 glow-text">TravelBoard</h1>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 sm:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-slate-800 px-3 py-2">
          <label htmlFor="sidebar-view" className="sr-only">
            Sidebar section
          </label>
          <select
            id="sidebar-view"
            value={dropdownValue}
            onChange={(e) => handleViewChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 focus:border-amber-500/60 focus:outline-none"
          >
            <optgroup label="View">
              <option value="world">World</option>
              <option value="wished">Wishes</option>
              <option value="visited">Visited</option>
              <option value="friends">Friends</option>
              <option value="settings">Settings</option>
            </optgroup>
          </select>
        </div>

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

        {panel === "friends" ? (
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
        ) : panel !== "settings" ? (
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
        ) : loggedIn ? (
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
