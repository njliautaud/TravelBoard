"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TravelMap, { type FocusPoint, type TravelMapHandle } from "./TravelMap";
import Sidebar from "./Sidebar";
import SidePanel, { type PanelSelection } from "./SidePanel";
import GeoBanner from "./GeoBanner";
import EntryForm, { type PinDropResult } from "./EntryForm";
import AuthModal from "./AuthModal";
import DraftInbox from "./DraftInbox";
import LocationDetailsModal from "./LocationDetailsModal";
import type { DraftItem, DraftPrefill, LocationItem, SessionUser } from "@/lib/types";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";

interface MapAppProps {
  initialLocations: LocationItem[];
}

export default function MapApp({ initialLocations }: MapAppProps) {
  const mapRef = useRef<TravelMapHandle>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [locations, setLocations] = useState<LocationItem[]>(initialLocations);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
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

  const loggedIn = user !== null;

  const refreshLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      if (Array.isArray(data.locations)) setLocations(data.locations);
    } catch {
      // keep stale
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

  const refreshSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch {
      // keep defaults
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshLocations(), refreshDrafts(), refreshSettings()]);
  }, [refreshLocations, refreshDrafts, refreshSettings]);

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

  // Poll for new WhatsApp drafts while logged in
  useEffect(() => {
    if (!loggedIn) return;
    const tick = () => refreshDrafts();
    const id = window.setInterval(tick, 15000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [loggedIn, refreshDrafts]);

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

  const handleDeleteDraft = async (draft: DraftItem) => {
    await fetch(`/api/drafts/${draft.id}`, { method: "DELETE" });
    refreshDrafts();
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
    setSettings(DEFAULT_SETTINGS);
    setSelection(null);
    setZoomedIn(false);
    mapRef.current?.resetWorldView();
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        locations={locations}
        editor={loggedIn}
        open={sidebarOpen}
        settings={settings}
        settingsSaving={settingsSaving}
        onClose={() => setSidebarOpen(false)}
        onAddPlace={handleAddPlace}
        onSelectWish={handleSelectWish}
        onToggleStar={handleToggleStar}
        onSettingsChange={handleSettingsChange}
      />

      <div className="relative flex-1 overflow-hidden">
        <TravelMap
          ref={mapRef}
          locations={locations}
          pinDropMode={pinDropMode}
          focusPoint={focusPoint}
          mapTheme={settings.mapTheme}
          onCountryClick={handleCountryClick}
          onDotClick={handleDotClick}
          onPinDrop={handlePinDrop}
          onZoomStateChange={handleZoomStateChange}
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
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open wish list"
              className="rounded-full border border-slate-700/60 bg-slate-900/80 p-2 text-slate-300 backdrop-blur hover:text-white sm:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <h1 className="rounded-full border border-slate-700/60 bg-slate-900/80 px-4 py-1.5 text-sm font-bold tracking-wide text-amber-300 backdrop-blur glow-text sm:hidden">
              TravelBoard
            </h1>
            <span className="w-8 sm:hidden" />
          </div>
          <div className="pointer-events-auto sm:absolute sm:left-1/2 sm:top-3 sm:-translate-x-1/2">
            <GeoBanner locations={locations} />
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            {loggedIn && (
              <button
                onClick={() => setInboxOpen(true)}
                className="relative rounded-full border border-violet-500/50 bg-violet-500/15 px-3 py-1.5 text-sm text-violet-200 backdrop-blur hover:bg-violet-500/25"
              >
                Inbox
                {drafts.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-violet-400 px-1.5 text-[10px] font-bold text-slate-950">
                    {drafts.length}
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

        {zoomedIn && loggedIn && (
          <div
            className={[
              "pointer-events-none absolute bottom-6 z-20 flex justify-center",
              "left-0 transition-[left,right] duration-300 ease-out",
              sidebarOpen ? "max-sm:left-72" : "",
              selection ? "right-0 sm:right-[400px]" : "right-0",
            ]
              .filter(Boolean)
              .join(" ")}
          >
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
      </div>

      <SidePanel
        selection={selection}
        locations={locations}
        editor={loggedIn}
        onClose={() => setSelection(null)}
        onDetails={handleViewDetails}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <LocationDetailsModal
        open={detailsLoc !== null}
        location={detailsLoc}
        editor={loggedIn}
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

      <DraftInbox
        open={inboxOpen}
        drafts={drafts}
        onClose={() => setInboxOpen(false)}
        onOpenDraft={openDraft}
        onDeleteDraft={handleDeleteDraft}
      />
    </div>
  );
}
