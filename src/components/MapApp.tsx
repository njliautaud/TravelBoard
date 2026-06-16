"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TravelMap, { type FocusPoint, type TravelMapHandle, type MapOverlayMode, type CountryDeal, type JournalCountry, type DealRoute } from "./TravelMap";
import Sidebar from "./Sidebar";
import SidePanel, { type PanelSelection } from "./SidePanel";
import GeoBanner from "./GeoBanner";
import EntryForm, { type PinDropResult } from "./EntryForm";
import AuthModal from "./AuthModal";
import DraftInbox from "./DraftInbox";
import AmbientMode from "./AmbientMode";
import type { DraftItem, DraftPrefill, LocationItem, SessionUser } from "@/lib/types";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";
import { DEMO_LOCATIONS, DEMO_COUNTRY_DEALS, DEMO_JOURNAL_COUNTRIES, DEMO_DEAL_ROUTES, setDemoMode, getDemoMode } from "@/lib/demoData";

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
  const [editing, setEditing] = useState<LocationItem | null>(null);
  const [draftPrefill, setDraftPrefill] = useState<DraftPrefill | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [pinDropMode, setPinDropMode] = useState(false);
  const [pinDropResult, setPinDropResult] = useState<PinDropResult | null>(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [inboxOpen, setInboxOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const settingsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overlayMode, setOverlayMode] = useState<MapOverlayMode>("deals");
  const [countryDeals, setCountryDeals] = useState<CountryDeal[]>([]);
  const [ambientMode, setAmbientMode] = useState(false);
  const [journalCountries, setJournalCountries] = useState<JournalCountry[]>([]);
  const [dealRoutes, setDealRoutes] = useState<DealRoute[]>([]);

  const loggedIn = user !== null;
  const isDemoActive = getDemoMode();

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
      .then((r) => {
        if (!r.ok) throw new Error("no-api");
        return r.json();
      })
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          refreshAll();
        }
      })
      .catch(() => {
        // Static/demo mode — populate with sample data
        setDemoMode(true);
        setLocations(DEMO_LOCATIONS);
        setCountryDeals(DEMO_COUNTRY_DEALS);
        setJournalCountries(DEMO_JOURNAL_COUNTRIES);
        setDealRoutes(DEMO_DEAL_ROUTES);
      });
  }, [refreshAll]);

  // Fetch country deals for map overlay (skip if demo data already loaded)
  useEffect(() => {
    if (overlayMode !== "deals") return;
    if (countryDeals.length > 0) return; // demo data already present
    fetch("/api/deals/countries")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.deals)) setCountryDeals(d.deals);
      })
      .catch(() => {});
    fetch("/api/deals/routes?limit=30")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.routes)) setDealRoutes(d.routes);
      })
      .catch(() => {});
  }, [overlayMode, countryDeals.length]);

  // Fetch journal countries for map highlighting (skip if demo data already loaded)
  useEffect(() => {
    if (!loggedIn && journalCountries.length > 0) return; // demo data present
    if (!loggedIn) return;
    fetch("/api/journal/countries")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.countries)) setJournalCountries(d.countries);
      })
      .catch(() => {});
  }, [loggedIn, journalCountries.length]);

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

  if (ambientMode) {
    return (
      <div className="relative h-dvh w-full">
        <AmbientMode />
        <button
          onClick={() => setAmbientMode(false)}
          className="absolute right-4 top-4 z-50 rounded-full border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 backdrop-blur transition hover:text-slate-200"
        >
          Exit Ambient
        </button>
      </div>
    );
  }

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
        {/* Map offset for sidebar nav on desktop */}
        <div className="absolute inset-0 sm:left-16">
          <TravelMap
            ref={mapRef}
            locations={locations}
            pinDropMode={pinDropMode}
            focusPoint={focusPoint}
            mapTheme={settings.mapTheme}
            overlayMode={overlayMode}
            countryDeals={countryDeals}
            journalCountries={journalCountries}
            dealRoutes={dealRoutes}
            onCountryClick={handleCountryClick}
            onDotClick={handleDotClick}
            onPinDrop={handlePinDrop}
            onZoomStateChange={handleZoomStateChange}
          />
        </div>

        {/* Overlay mode toggle — Wishes / Deals / Ambient */}
        <div className="pointer-events-auto absolute bottom-14 sm:bottom-4 left-4 sm:left-20 z-20 flex rounded-full border border-slate-700/50 bg-slate-900/85 p-0.5 backdrop-blur-lg shadow-lg">
          <button
            onClick={() => setOverlayMode("wishes")}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
              overlayMode === "wishes"
                ? "bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                : "text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            Wishes
          </button>
          <button
            onClick={() => setOverlayMode("deals")}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
              overlayMode === "deals"
                ? "bg-teal-500/20 text-teal-300 shadow-[0_0_8px_rgba(20,184,166,0.2)]"
                : "text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            Deals
          </button>
          <button
            onClick={() => setAmbientMode(true)}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition-all duration-200 hover:text-slate-300"
            title="Enter ambient wall display mode"
          >
            Ambient
          </button>
        </div>

        {/* Welcome overlay for logged-out users — only when NOT in demo mode (demo uses AppShell landing) */}
        {!loggedIn && !authOpen && !isDemoActive && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            {/* Subtle dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-slate-950/60" />
            <div className="pointer-events-auto relative max-w-md rounded-2xl border border-slate-700/50 bg-slate-950/90 p-8 text-center shadow-2xl backdrop-blur-xl animate-fade-up">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-100">
                Welcome to <span className="text-amber-400 glow-text">TravelBoard</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Your personal travel map. Pin your dream destinations, track flight deals, and build a visual journal of everywhere you want to go.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
                <button
                  onClick={() => requireAuth("login")}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                >
                  Log in
                </button>
                <button
                  onClick={() => requireAuth("register")}
                  className="rounded-xl border border-slate-600/80 px-6 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800/50"
                >
                  Create account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top header bar */}
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:pl-20">
          <div className="pointer-events-auto flex w-full items-center justify-between gap-2 sm:w-auto">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open wish list"
              className="rounded-full border border-slate-700/50 bg-slate-900/80 p-2 text-slate-300 backdrop-blur-lg hover:text-white sm:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <h1 className="rounded-full border border-slate-700/50 bg-slate-900/80 px-4 py-1.5 text-sm font-bold tracking-wide text-amber-300 backdrop-blur-lg glow-text sm:hidden">
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
                className="relative rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-200 backdrop-blur-lg transition hover:bg-violet-500/20"
              >
                Inbox
                {drafts.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-400 px-1 text-[10px] font-bold text-slate-950">
                    {drafts.length}
                  </span>
                )}
              </button>
            )}
            {loggedIn ? (
              <>
                <span className="hidden rounded-full bg-slate-800/60 px-2.5 py-1 text-xs text-slate-400 sm:inline">
                  {user.username}
                </span>
                <button
                  onClick={logout}
                  className="rounded-full border border-slate-700/50 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-400 backdrop-blur-lg transition hover:text-slate-200"
                >
                  Log out
                </button>
              </>
            ) : !isDemoActive ? (
              <>
                <button
                  onClick={() => requireAuth("register")}
                  className="rounded-full border border-slate-700/50 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-300 backdrop-blur-lg transition hover:text-white"
                >
                  Sign up
                </button>
                <button
                  onClick={() => requireAuth("login")}
                  className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200 backdrop-blur-lg transition hover:bg-amber-500/20"
                >
                  Log in
                </button>
              </>
            ) : null}
          </div>
        </header>

        {/* World view button */}
        {zoomedIn && loggedIn && (
          <div
            className={[
              "pointer-events-none absolute bottom-14 sm:bottom-6 z-20 flex justify-center",
              "left-0 transition-[left,right] duration-300 ease-out sm:left-16",
              sidebarOpen ? "max-sm:left-72" : "",
              selection ? "right-0 sm:right-[400px]" : "right-0",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              onClick={() => mapRef.current?.resetWorldView()}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-600/60 bg-slate-900/85 px-5 py-2.5 text-sm font-medium text-slate-200 shadow-lg backdrop-blur-lg transition hover:border-amber-500/50 hover:text-amber-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              World view
            </button>
          </div>
        )}

        {/* Pin drop mode indicator */}
        {pinDropMode && (
          <div className="absolute inset-x-0 top-20 z-20 flex justify-center">
            <div className="rounded-full border border-amber-500/50 bg-slate-900/90 px-4 py-2 text-sm text-amber-200 shadow-lg backdrop-blur-lg animate-fade-up">
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
        onEdit={openEdit}
        onDelete={handleDelete}
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
        onRefresh={refreshDrafts}
      />
    </div>
  );
}
