"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TravelMap, { type FocusPoint, type TravelMapHandle } from "./TravelMap";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import SidePanel, { type PanelSelection } from "./SidePanel";
import GeoBanner from "./GeoBanner";
import EntryForm, { type PinDropResult } from "./EntryForm";
import AuthModal from "./AuthModal";
import UsernameModal from "./UsernameModal";
import InboxOverlay from "./InboxOverlay";
import LocationDetailsModal from "./LocationDetailsModal";
import PassportOnboarding from "./PassportOnboarding";
import type {
  DraftItem,
  DraftPrefill,
  LocationItem,
  NotificationItem,
  Panel,
  SessionUser,
  StatusFilter,
  UserProfile,
} from "@/lib/types";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";
import { passportTogglePatch } from "@/lib/regions";
import { loadUsStates, type UsStateFeature } from "@/lib/usStates";
import { unitForLocation } from "@/lib/geoUnits";
import {
  readCachedLocations,
  readLastBoardId,
  writeCachedLocations,
  writeLastBoardId,
} from "@/lib/localCache";

interface MapAppProps {
  initialLocations: LocationItem[];
}

export default function MapApp({ initialLocations }: MapAppProps) {
  const mapRef = useRef<TravelMapHandle>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [locations, setLocations] = useState<LocationItem[]>(initialLocations);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // Bumped to make the sidebar Friends tab refetch after an inbox action.
  const [friendsRefresh, setFriendsRefresh] = useState(0);
  const [selection, setSelection] = useState<PanelSelection>(null);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [zoomedIn, setZoomedIn] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [detailsLoc, setDetailsLoc] = useState<LocationItem | null>(null);
  const [editing, setEditing] = useState<LocationItem | null>(null);
  const [draftPrefill, setDraftPrefill] = useState<DraftPrefill | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [pinDropMode, setPinDropMode] = useState(false);
  const [pinDropResult, setPinDropResult] = useState<PinDropResult | null>(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [inboxOpen, setInboxOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(false);
  const [pendingShare, setPendingShare] = useState<{ url: string; text: string | null } | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const settingsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Map view filter (bottom-center toggle) + US-state geometry for states mode.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [usStates, setUsStates] = useState<UsStateFeature[] | null>(null);
  // Active sidebar section, lifted so the bottom-center selector drives it too.
  const [panel, setPanel] = useState<Panel>("journal");

  // Which friend's board you're viewing now (null = your own). Viewing is read-only.
  const [viewedUser, setViewedUser] = useState<UserProfile | null>(null);
  // The viewed friend's passport (their visited regions) for the glow on their board.
  const [viewedVisitedRegions, setViewedVisitedRegions] = useState<string[]>([]);
  // Whether to show the one-time "map where you've been" onboarding.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);

  const loggedIn = user !== null;
  const canEdit = loggedIn && viewedUser === null;
  // Passport editing mode (own board only). While active the map temporarily
  // shows US states (so each is clickable) and the "been there" glow is on.
  const passportMode = canEdit && panel === "passport";
  const showStates = settings.usaAsStates || passportMode;
  // Hide the passport glow while filtering to wishes; show it in World/Visited
  // and always in passport mode.
  const showVisitedGlow = passportMode || statusFilter !== "wished";
  // Inbox badge: shared-link drafts + unread friend notifications.
  const inboxBadge = drafts.length + notifications.filter((n) => !n.read).length;

  // userId omitted ⇒ your own board; otherwise a friend's board (read-only).
  const refreshLocations = useCallback(async (userId?: string) => {
    try {
      const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const res = await fetch(`/api/locations${qs}`);
      const data = await res.json();
      // Stale-while-revalidate: patch the (already cache-painted) UI with fresh data.
      if (Array.isArray(data.locations)) setLocations(data.locations);
      // When viewing a friend's board, capture their passport for the glow.
      if (userId && Array.isArray(data.visitedRegions)) {
        setViewedVisitedRegions(data.visitedRegions);
      }
    } catch {
      // Offline / error: keep whatever is shown (the local cache, usually).
    }
  }, []);

  const refreshDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/drafts");
      const data = await res.json();
      if (Array.isArray(data.drafts)) setDrafts(data.drafts);
    } catch {
      // keep stale
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (Array.isArray(data.notifications)) setNotifications(data.notifications);
    } catch {
      // keep stale
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      setNeedsOnboarding(Boolean(data.needsPassportOnboarding));
    } catch {
      // keep defaults
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshLocations(),
      refreshDrafts(),
      refreshNotifications(),
      refreshSettings(),
    ]);
  }, [refreshLocations, refreshDrafts, refreshNotifications, refreshSettings]);

  // Whenever the viewed board changes (incl. first login), paint instantly from
  // the local cache, then revalidate from the server in the background.
  useEffect(() => {
    if (!loggedIn) return;
    const boardId = viewedUser?.id ?? user?.id;
    if (boardId) {
      const cached = readCachedLocations(boardId);
      if (cached) setLocations(cached); // instant first paint
    }
    refreshLocations(viewedUser?.id);
  }, [viewedUser, loggedIn, user?.id, refreshLocations]);

  // Instant boot paint: before /api/auth/me even resolves, render the last
  // own-board straight from cache — but only if a session cookie is present, so a
  // logged-out visitor never sees stale wishes. Runs once on mount.
  useEffect(() => {
    if (typeof document === "undefined" || !document.cookie.includes("tb_session=")) return;
    const lastId = readLastBoardId();
    const cached = lastId ? readCachedLocations(lastId) : null;
    if (cached && cached.length) setLocations(cached);
  }, []);

  // Mirror the visible board into the local cache on every change (instant, local).
  useEffect(() => {
    if (!loggedIn || !user) return;
    const boardId = viewedUser?.id ?? user.id;
    writeCachedLocations(boardId, locations);
    if (!viewedUser) writeLastBoardId(user.id); // your own board is the boot paint
  }, [locations, loggedIn, user, viewedUser]);

  // Switch the viewed board (null = back to your own) and reset the map context.
  const selectProfile = useCallback((profile: UserProfile | null) => {
    setViewedUser(profile);
    setViewedVisitedRegions([]); // cleared until the friend's board loads
    setSelection(null);
    setStatusFilter("all");
    setSidebarOpen(false);
    mapRef.current?.resetWorldView();
  }, []);

  // Mark the "map where you've been" onboarding finished/dismissed (one-shot).
  const finishOnboarding = useCallback(async () => {
    setNeedsOnboarding(false);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passportOnboarded: true }),
      });
    } catch {
      // best-effort; the flag re-shows next load if this failed
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          refreshAll();
        }
      })
      .catch(() => {});
  }, [refreshAll]);

  // Poll for new inbox items (shared links + friend notifications) while logged in
  useEffect(() => {
    if (!loggedIn) return;
    const tick = () => {
      refreshDrafts();
      refreshNotifications();
    };
    const id = window.setInterval(tick, 15000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [loggedIn, refreshDrafts, refreshNotifications]);

  // Lazy-load US-state polygons the first time states mode is needed (real
  // setting, or temporarily while in passport mode).
  useEffect(() => {
    if (showStates && !usStates) {
      loadUsStates()
        .then(setUsStates)
        .catch(() => {});
    }
  }, [showStates, usStates]);

  // Which map unit (country, or US state in states mode) a wish belongs to.
  // Shared with the map so the SidePanel shows the same grouping.
  const unitCodeOf = useCallback(
    (loc: LocationItem) =>
      unitForLocation(loc, { usaAsStates: settings.usaAsStates, states: usStates }).code,
    [settings.usaAsStates, usStates],
  );

  const handleCountryClick = useCallback((code: string, name: string) => {
    setSelection({ type: "country", code, name });
  }, []);

  const handleDotClick = useCallback((id: string) => {
    setSelection({ type: "location", id });
  }, []);

  const handleZoomStateChange = useCallback((zoomedIn: boolean) => {
    setZoomedIn(zoomedIn);
    if (!zoomedIn) setSelection(null);
  }, []);

  const handlePinDrop = useCallback(async (lat: number, lng: number) => {
    setPinDropMode(false);
    let geocode = null;
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`);
      const data = await res.json();
      geocode = data.results?.[0] ?? null;
    } catch {
      // ok
    }
    setPinDropResult({ latitude: lat, longitude: lng, geocode });
  }, []);

  const openAdd = () => {
    setEditing(null);
    setDraftPrefill(null);
    setActiveDraftId(null);
    setPinDropResult(null);
    setFormOpen(true);
  };

  const requireAuth = (mode: "login" | "register", thenAdd = false) => {
    setAuthMode(mode);
    setPendingAdd(thenAdd);
    setAuthOpen(true);
  };

  const handleAddPlace = () => {
    setSidebarOpen(false);
    if (loggedIn) openAdd();
    else requireAuth("login", true);
  };

  // Right-click "Add wish here" on the map: open a blank add form prefilled with
  // the clicked country/region/city + coordinates (reuses the pin-drop geocode).
  const handleAddWishHere = (lat: number, lng: number) => {
    if (!loggedIn) {
      requireAuth("login", true);
      return;
    }
    setSidebarOpen(false);
    setEditing(null);
    setDraftPrefill(null);
    setActiveDraftId(null);
    setPinDropResult(null);
    setFormOpen(true);
    handlePinDrop(lat, lng);
  };

  const handleSelectWish = (loc: LocationItem) => {
    setSidebarOpen(false);
    setSelection({ type: "location", id: loc.id });
    setFocusPoint({
      lng: loc.longitude,
      lat: loc.latitude,
      dimCountry: loc.countryCode,
      nonce: Date.now(),
    });
  };

  const handleViewDetails = useCallback((loc: LocationItem) => {
    setDetailsLoc(loc);
    setFocusPoint({
      lng: loc.longitude,
      lat: loc.latitude,
      dimCountry: loc.countryCode,
      nonce: Date.now(),
    });
  }, []);

  const openEdit = (loc: LocationItem) => {
    setEditing(loc);
    setDraftPrefill(null);
    setActiveDraftId(null);
    setPinDropResult(null);
    setFormOpen(true);
  };

  const openDraft = (draft: DraftItem) => {
    setInboxOpen(false);
    setEditing(null);
    setActiveDraftId(draft.id);
    setDraftPrefill({
      activityName: "",
      notes: "",
      enrichUrl: draft.extractedUrl ?? undefined,
      enrichRawText: draft.rawText,
      media: draft.extractedUrl
        ? [{ type: "LINK", url: draft.extractedUrl, caption: "Source link", sortOrder: 0 }]
        : [],
    });
    setPinDropResult(null);
    setFormOpen(true);
  };

  // Open the prefilled "Add a place" form from a shared link (Android share / ?share= URL).
  const openSharePrefill = useCallback((url: string, text: string | null) => {
    setInboxOpen(false);
    setSidebarOpen(false);
    setEditing(null);
    setActiveDraftId(null);
    setDraftPrefill({
      activityName: "",
      notes: "",
      enrichUrl: url,
      enrichRawText: text && text.trim() ? text : url,
      media: [{ type: "LINK", url, caption: "Source link", sortOrder: 0 }],
    });
    setPinDropResult(null);
    setFormOpen(true);
  }, []);

  // Capture a ?share=<url>&text=<caption> deep-link (Android share target) once on load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const url = params.get("share")?.trim();
    if (!url) return;
    setPendingShare({ url, text: params.get("text") });
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // Open the prefilled form as soon as we're logged in (immediately, or after login).
  useEffect(() => {
    if (!pendingShare || !loggedIn) return;
    openSharePrefill(pendingShare.url, pendingShare.text);
    setPendingShare(null);
  }, [pendingShare, loggedIn, openSharePrefill]);

  const handleDelete = async (loc: LocationItem) => {
    if (!window.confirm(`Delete "${loc.activityName}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/locations/${loc.id}`, { method: "DELETE" });
    if (res.ok) {
      if (selection?.type === "location" && selection.id === loc.id) setSelection(null);
      refreshLocations();
    }
  };

  const handleReorder = async (orderedIds: string[]) => {
    // Optimistic: apply the new sortOrder locally so the list stays put.
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    setLocations((prev) =>
      prev.map((l) => (rank.has(l.id) ? { ...l, sortOrder: rank.get(l.id)! } : l))
    );
    try {
      await fetch("/api/locations/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: orderedIds }),
      });
    } catch {
      // optimistic order already applied; a later refresh reconciles
    }
    refreshLocations();
  };

  const handleToggleStar = async (loc: LocationItem) => {
    const next = !loc.starred;
    setLocations((prev) => prev.map((l) => (l.id === loc.id ? { ...l, starred: next } : l)));
    try {
      const res = await fetch(`/api/locations/${loc.id}/star`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: next }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setLocations((prev) => prev.map((l) => (l.id === loc.id ? data.location : l)));
    } catch {
      setLocations((prev) => prev.map((l) => (l.id === loc.id ? { ...l, starred: loc.starred } : l)));
    }
  };

  const handleSettingsChange = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (settingsSaveRef.current) clearTimeout(settingsSaveRef.current);
      settingsSaveRef.current = setTimeout(async () => {
        setSettingsSaving(true);
        try {
          const res = await fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          const data = await res.json();
          if (res.ok && data.settings) setSettings(data.settings);
        } catch {
          // optimistic UI already applied via setSettings above
        } finally {
          setSettingsSaving(false);
        }
      }, 400);
      return next;
    });
  }, []);

  // Double-click a country/state on the map (in passport mode) to add/remove it.
  const handlePassportToggle = useCallback(
    (code: string) => {
      handleSettingsChange(passportTogglePatch(settings.visitedRegions, code, settings.usaAsStates));
    },
    [handleSettingsChange, settings.visitedRegions, settings.usaAsStates],
  );

  const handleDeleteDraft = async (draft: DraftItem) => {
    await fetch(`/api/drafts/${draft.id}`, { method: "DELETE" });
    refreshDrafts();
  };

  // Friend request acted on from the inbox — sync the badge, profile list, and
  // the sidebar Friends tab.
  const respondToRequest = async (friendshipId: string, action: "accept" | "decline") => {
    try {
      await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    } finally {
      await refreshNotifications();
      setFriendsRefresh((n) => n + 1);
    }
  };

  // Friends tab changed something — keep the inbox badge in sync.
  const handleFriendsChanged = useCallback(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // Opening the inbox clears the informational "X accepted you" badges, but
  // leaves pending friend requests actionable.
  const openInbox = async () => {
    setInboxOpen(true);
    if (notifications.some((n) => !n.read && n.type === "FRIEND_ACCEPTED")) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "FRIEND_ACCEPTED" }),
      });
      refreshNotifications();
    }
  };

  const handleSaved = async (opts?: { draftId?: string }) => {
    setFormOpen(false);
    setPinDropResult(null);
    setDraftPrefill(null);
    if (opts?.draftId) {
      await fetch(`/api/drafts/${opts.draftId}`, { method: "DELETE" });
    }
    setActiveDraftId(null);
    refreshAll();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setLocations([]);
    setDrafts([]);
    setNotifications([]);
    setSettings(DEFAULT_SETTINGS);
    setViewedUser(null);
    setViewedVisitedRegions([]);
    setNeedsOnboarding(false);
    setSelection(null);
    setZoomedIn(false);
    mapRef.current?.resetWorldView();
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        locations={locations}
        editor={canEdit}
        loggedIn={loggedIn}
        open={sidebarOpen}
        settings={settings}
        settingsSaving={settingsSaving}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        panel={panel}
        onPanelChange={setPanel}
        viewedUser={viewedUser}
        friendsRefresh={friendsRefresh}
        onFriendsChanged={handleFriendsChanged}
        onSelectProfile={selectProfile}
        onClose={() => setSidebarOpen(false)}
        onAddPlace={handleAddPlace}
        onSelectWish={handleSelectWish}
        onToggleStar={handleToggleStar}
        onSettingsChange={handleSettingsChange}
      />

      {loggedIn && (
        <BottomNav
          panel={panel}
          sheetOpen={sidebarOpen}
          canEdit={canEdit}
          onSelect={(p) => {
            // Tap the active section again to dismiss its sheet; otherwise switch + open.
            if (p === panel && sidebarOpen) setSidebarOpen(false);
            else {
              setPanel(p);
              setSidebarOpen(true);
            }
          }}
        />
      )}

      <div className="relative flex-1 overflow-hidden">
        <TravelMap
          ref={mapRef}
          locations={locations}
          pinDropMode={pinDropMode}
          focusPoint={focusPoint}
          mapTheme={settings.mapTheme}
          statusFilter={statusFilter}
          usaAsStates={showStates}
          visitedRegions={viewedUser ? viewedVisitedRegions : settings.visitedRegions}
          showVisitedGlow={showVisitedGlow}
          passportMode={passportMode}
          onPassportToggle={handlePassportToggle}
          states={usStates}
          onCountryClick={handleCountryClick}
          onDotClick={handleDotClick}
          onPinDrop={handlePinDrop}
          onZoomStateChange={handleZoomStateChange}
          canAddWish={canEdit}
          onAddWishHere={handleAddWishHere}
        />

        {!loggedIn && !authOpen && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
            <div className="pointer-events-auto max-w-sm rounded-2xl border border-slate-700/70 bg-slate-950/95 p-6 text-center shadow-2xl">
              <h2 className="text-lg font-bold text-slate-100">Welcome to TravelBoard</h2>
              <p className="mt-2 text-sm text-slate-400">
                Log in or create an account to build your personal travel map and wishlist.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => requireAuth("login")}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
                >
                  Log in
                </button>
                <button
                  onClick={() => requireAuth("register")}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Create account
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="pointer-events-auto flex w-full items-center justify-between gap-2 sm:w-auto">
            <h1 className="rounded-full border border-slate-700/60 bg-slate-900/80 px-4 py-1.5 text-sm font-bold tracking-wide text-amber-300 backdrop-blur glow-text sm:hidden">
              TravelBoard
            </h1>
          </div>
          <div className="pointer-events-auto sm:absolute sm:left-1/2 sm:top-3 sm:-translate-x-1/2">
            <GeoBanner locations={locations} />
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            {loggedIn && (
              <button
                onClick={openInbox}
                className="relative rounded-full border border-violet-500/50 bg-violet-500/15 px-3 py-1.5 text-sm text-violet-200 backdrop-blur hover:bg-violet-500/25"
              >
                Inbox
                {inboxBadge > 0 && (
                  <span className="ml-1.5 rounded-full bg-violet-400 px-1.5 text-[10px] font-bold text-slate-950">
                    {inboxBadge}
                  </span>
                )}
              </button>
            )}
            {loggedIn ? (
              <>
                <span className="hidden text-xs text-slate-500 sm:inline">{user.username}</span>
                <button
                  onClick={logout}
                  className="rounded-full border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-400 backdrop-blur hover:text-slate-200"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => requireAuth("register")}
                  className="rounded-full border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-300 backdrop-blur hover:text-white"
                >
                  Sign up
                </button>
                <button
                  onClick={() => requireAuth("login")}
                  className="rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-sm text-amber-200 backdrop-blur hover:bg-amber-500/25"
                >
                  Log in
                </button>
              </>
            )}
          </div>
        </header>

        {loggedIn && (
          <div
            className={[
              "pointer-events-none absolute bottom-20 z-20 flex flex-col items-center gap-2 sm:bottom-6",
              "left-0 transition-[left,right] duration-300 ease-out",
              sidebarOpen ? "max-sm:left-72" : "",
              selection ? "right-0 sm:right-[400px]" : "right-0",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {zoomedIn && (
              <button
                onClick={() => mapRef.current?.resetWorldView()}
                className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-600/80 bg-slate-900/90 px-5 py-2.5 text-sm font-medium text-slate-200 shadow-lg backdrop-blur transition hover:border-amber-500/50 hover:text-amber-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                World view
              </button>
            )}

            {/* World / Wished / Visited map filter + Passport mode (own board) */}
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-600/80 bg-slate-900/90 p-1 text-sm shadow-lg backdrop-blur">
              {([
                ["all", "World", "bg-amber-500/90 text-slate-950"],
                ["wished", "Wished", "bg-amber-500/90 text-slate-950"],
                ["visited", "Visited", "bg-emerald-500/90 text-slate-950"],
              ] as const).map(([value, label, activeCls]) => {
                const active = !passportMode && statusFilter === value;
                return (
                  <button
                    key={value}
                    onClick={() => {
                      setStatusFilter(value);
                      if (panel === "passport") setPanel("journal");
                    }}
                    className={`rounded-full px-4 py-1.5 font-medium transition ${
                      active ? activeCls : "text-slate-300 hover:text-amber-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {canEdit && (
                <button
                  onClick={() => setPanel("passport")}
                  className={`rounded-full px-4 py-1.5 font-medium transition ${
                    passportMode ? "bg-teal-500/90 text-slate-950" : "text-slate-300 hover:text-teal-200"
                  }`}
                >
                  Passport
                </button>
              )}
            </div>
          </div>
        )}

        {pinDropMode && (
          <div className="absolute inset-x-0 top-20 z-20 flex justify-center">
            <div className="rounded-full border border-amber-500/60 bg-slate-900/90 px-4 py-2 text-sm text-amber-200 backdrop-blur">
              Click anywhere on the map to drop the pin
              <button
                onClick={() => setPinDropMode(false)}
                className="ml-3 text-xs text-slate-400 underline hover:text-slate-200"
              >
                cancel
              </button>
            </div>
          </div>
        )}

        <PassportOnboarding
          open={loggedIn && viewedUser === null && needsOnboarding}
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onFinish={finishOnboarding}
        />
      </div>

      <SidePanel
        selection={selection}
        locations={locations}
        editor={canEdit}
        statusFilter={statusFilter}
        unitCodeOf={unitCodeOf}
        onClose={() => setSelection(null)}
        onDetails={handleViewDetails}
        onEdit={openEdit}
        onDelete={handleDelete}
        onReorder={handleReorder}
      />

      <LocationDetailsModal
        open={detailsLoc !== null}
        location={detailsLoc}
        editor={canEdit}
        onClose={() => setDetailsLoc(null)}
        onEdit={(loc) => {
          setDetailsLoc(null);
          openEdit(loc);
        }}
      />

      <EntryForm
        open={formOpen}
        hidden={pinDropMode}
        editing={editing}
        draftPrefill={draftPrefill}
        draftId={activeDraftId}
        existingLocations={locations}
        defaultStatus={statusFilter === "visited" ? "VISITED" : "TO_VISIT"}
        pinDropResult={pinDropResult}
        onRequestPinDrop={() => setPinDropMode(true)}
        onClose={() => {
          setFormOpen(false);
          setPinDropMode(false);
          setDraftPrefill(null);
          setActiveDraftId(null);
        }}
        onSaved={handleSaved}
      />

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => {
          setAuthOpen(false);
          setPendingAdd(false);
        }}
        onSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setAuthOpen(false);
          refreshAll();
          if (pendingAdd) {
            setPendingAdd(false);
            openAdd();
          }
        }}
      />

      {/* OAuth signups land here logged-in but without a username — make them pick one. */}
      {user && user.usernameSet === false && (
        <UsernameModal
          suggested={user.username}
          onDone={(updated) => {
            setUser(updated);
            refreshAll();
          }}
        />
      )}

      <InboxOverlay
        open={inboxOpen}
        notifications={notifications}
        drafts={drafts}
        onClose={() => setInboxOpen(false)}
        onAcceptRequest={(friendshipId) => respondToRequest(friendshipId, "accept")}
        onDeclineRequest={(friendshipId) => respondToRequest(friendshipId, "decline")}
        onOpenDraft={openDraft}
        onDeleteDraft={handleDeleteDraft}
      />
    </div>
  );
}
