"use client";

import { useEffect, useState, useCallback } from "react";
import MapApp from "./MapApp";
import JournalView from "./JournalView";
import SettingsView from "./SettingsView";
import SearchView from "./SearchView";
import ToolsView from "./ToolsView";
import CommunityView from "./CommunityView";
import AlertsPanel, { AlertBellBadge } from "./AlertsPanel";
import { ErrorBoundary, CalendarSkeleton } from "./ErrorBoundary";
import { Changelog, useUnseenChangelog } from "./Changelog";
import { loadLocalPrefs, DEFAULT_PREFS, type TravelPrefsDto, OnboardingWizard, type OnboardingData } from "./Onboarding";
import AuthModal from "./AuthModal";
import UserProfile from "./UserProfile";
import ActivityFeed from "./ActivityFeed";
import type { LocationItem, SessionUser } from "@/lib/types";
import { getDemoMode } from "@/lib/demoData";

type Tab = "map" | "search" | "alerts" | "journal" | "tools" | "community" | "settings";

interface AppShellProps {
  initialLocations: LocationItem[];
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "map",
    label: "Explore",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: "search",
    label: "Search",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: "alerts",
    label: "Alerts",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: "journal",
    label: "Journal",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  {
    id: "tools",
    label: "Tools",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: "community",
    label: "Community",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function AppShell({ initialLocations }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [alertCount, setAlertCount] = useState(0);
  const [showChangelog, setShowChangelog] = useState(false);
  const unseenChangelog = useUnseenChangelog();
  const [showProfile, setShowProfile] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [prefs, setPrefs] = useState<TravelPrefsDto>(DEFAULT_PREFS);
  const [appEntered, setAppEntered] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  // Map always shows deals — unified experience, no separate deals tab
  const dealsMode = activeTab === "map";

  // Check auth + onboarding status on mount
  useEffect(() => {
    const { prefs: loadedPrefs } = loadLocalPrefs();
    setPrefs(loadedPrefs);

    // Check if user is logged in
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
          // Check onboarding status
          fetch("/api/onboarding")
            .then((r) => r.json())
            .then((ob) => {
              if (ob.onboarded) {
                setAppEntered(true);
              } else {
                setShowOnboarding(true);
              }
            })
            .catch(() => setAppEntered(true));
        } else {
          // Not logged in — stay on landing page (HC #631: login required)
          // Do NOT auto-enter from localStorage
        }
      })
      .catch(() => {
        // API unavailable — stay on landing, require login
      });
  }, []);

  // Poll unread alert count periodically (skip in demo mode)
  useEffect(() => {
    if (getDemoMode()) return;
    let stopped = false;
    const fetchCount = () => {
      if (stopped) return;
      fetch("/api/alerts")
        .then((r) => {
          if (!r.ok) { stopped = true; return null; }
          return r.json();
        })
        .then((d) => { if (d) setAlertCount(d.unreadCount ?? 0); })
        .catch(() => { stopped = true; });
    };
    fetchCount();
    const iv = setInterval(fetchCount, 60_000);
    return () => clearInterval(iv);
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
  }, []);

  // Map is the primary view — everything else overlays on top
  const isOverlay = activeTab !== "map";

  // Always show all tabs — hiding them based on demo mode caused flickering
  // when auth state changed asynchronously. Features degrade gracefully instead.
  const visibleTabs = TABS;

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      {/* Map is ALWAYS rendered — it IS the app */}
      <div className="absolute inset-0 z-0">
        <MapApp initialLocations={initialLocations} dealsMode={dealsMode} />
      </div>

      {/* Landing state — map visible behind, compelling hero card */}
      {!appEntered && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-end pb-28 sm:justify-center sm:pb-0 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-5 rounded-3xl border border-slate-700/40 bg-slate-950/75 px-8 py-8 sm:px-12 sm:py-10 backdrop-blur-2xl shadow-2xl max-w-sm mx-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <span className="text-3xl font-bold tracking-tight text-amber-400 glow-text">
              TravelBoard
            </span>
            <p className="max-w-xs text-center text-sm leading-relaxed text-slate-300">
              Discover cheap flights, track award deals from seats.aero, and build your travel bucket list on an interactive map.
            </p>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-400" />
                Live flight deals
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                Award search
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Bucket list
              </span>
            </div>
            <button
              onClick={() => {
                // Show auth/onboarding flow
                setShowAuth(true);
              }}
              className="mt-1 w-full rounded-2xl bg-amber-500 px-8 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 hover:shadow-amber-400/30 active:scale-95"
            >
              Get Started
            </button>
            <button
              onClick={() => {
                setShowAuth(true);
              }}
              className="w-full rounded-2xl border border-slate-700 px-8 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
            >
              Log in
            </button>
            {/* Login required — no guest access (HC #631) */}
          </div>
        </div>
      )}

      {/* Auth modal — non-dismissable when not logged in (HC #631: login required) */}
      {showAuth && (
        <AuthModal
          open={showAuth}
          onClose={() => { if (currentUser) setShowAuth(false); }}
          required={!currentUser}
          onSuccess={(user: SessionUser) => {
            setCurrentUser(user);
            setShowAuth(false);
            // Check if they need onboarding
            fetch("/api/onboarding")
              .then((r) => r.json())
              .then((ob) => {
                if (ob.onboarded) {
                  setAppEntered(true);
                  localStorage.setItem("tb_entered", "1");
                } else {
                  setShowOnboarding(true);
                }
              })
              .catch(() => {
                setShowOnboarding(true);
              });
          }}
          initialMode="register"
        />
      )}

      {/* Onboarding wizard */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={(_data: OnboardingData) => {
            setShowOnboarding(false);
            setAppEntered(true);
            if (typeof window !== "undefined") localStorage.setItem("tb_entered", "1");
          }}
        />
      )}

      {/* Overlay panel for non-map tabs — slides over the map with backdrop blur */}
      {isOverlay && appEntered && (
        <div className="absolute inset-0 z-30 flex">
          {/* Dismiss backdrop on desktop */}
          <div
            className="hidden sm:block sm:w-16 flex-shrink-0"
            onClick={() => setActiveTab("map")}
          />
          <div
            className="hidden sm:block flex-1 max-w-[calc(100%-480px-64px)]"
            onClick={() => setActiveTab("map")}
          />
          {/* Panel */}
          <div className="flex-1 sm:w-[480px] sm:max-w-[480px] sm:flex-none sm:ml-auto flex flex-col bg-slate-950/[0.97] backdrop-blur-xl border-l border-slate-800/60 animate-slide-in overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-2">
              <h2 className="text-sm font-semibold text-slate-200">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              <button
                onClick={() => setActiveTab("map")}
                className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeTab === "search" && (
                <ErrorBoundary name="Search"><SearchView /></ErrorBoundary>
              )}
              {activeTab === "alerts" && (
                <ErrorBoundary name="Alerts"><AlertsPanel /></ErrorBoundary>
              )}
              {activeTab === "journal" && (
                <ErrorBoundary name="Journal"><JournalView /></ErrorBoundary>
              )}
              {activeTab === "tools" && (
                <ErrorBoundary name="Tools"><ToolsView /></ErrorBoundary>
              )}
              {activeTab === "community" && (
                <ErrorBoundary name="Community"><CommunityView /></ErrorBoundary>
              )}
              {activeTab === "settings" && (
                <ErrorBoundary name="Settings"><SettingsView /></ErrorBoundary>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar nav — visible only after entering the app */}
      <nav className={`${appEntered ? "hidden sm:flex" : "hidden"} absolute left-0 top-0 bottom-0 z-40 w-16 flex-col items-center gap-1 border-r border-slate-800/60 bg-slate-950/90 backdrop-blur-lg pt-3 pb-3`}>
        <div className="mb-3 flex flex-col items-center">
          <span className="text-base font-bold tracking-wider text-amber-400 glow-text select-none">TB</span>
          <span className="mt-0.5 h-px w-8 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        </div>
        {/* Profile / Activity / Changelog */}
        {(
          <>
            <button
              onClick={() => setShowProfile(true)}
              title="Profile"
              className="mb-1 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium text-slate-500 transition-all duration-200 hover:bg-slate-800/80 hover:text-slate-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Profile</span>
            </button>
            <button
              onClick={() => setShowActivityFeed(true)}
              title="Activity"
              className="mb-1 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium text-slate-500 transition-all duration-200 hover:bg-slate-800/80 hover:text-slate-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Activity</span>
            </button>
            <button
              onClick={() => setShowChangelog(true)}
              title="What's New"
              className="relative mb-1 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium text-slate-500 transition-all duration-200 hover:bg-slate-800/80 hover:text-slate-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <span>New</span>
              {unseenChangelog > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-slate-950">
                  {unseenChangelog}
                </span>
              )}
            </button>
          </>
        )}
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              title={tab.label}
              data-testid={`nav-${tab.id}`}
              className={[
                "relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium transition-all duration-200",
                active
                  ? "bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                  : "text-slate-500 hover:bg-slate-800/80 hover:text-slate-300",
              ].join(" ")}
            >
              {tab.id === "alerts" ? (
                <AlertBellBadge count={alertCount} />
              ) : (
                tab.icon
              )}
              <span>{tab.label}</span>
              {active && (
                <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile bottom tab bar — 5 visible tabs, "More" opens overflow */}
      <nav className={`${appEntered ? "flex sm:hidden" : "hidden"} absolute bottom-0 left-0 right-0 z-40 items-stretch border-t border-slate-800/60 bg-slate-950/95 backdrop-blur-lg safe-area-bottom`}>
        {visibleTabs.filter((t) => ["map", "search", "journal", "tools"].includes(t.id)).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { handleTabChange(tab.id); setShowMoreMenu(false); }}
              className={[
                "relative flex min-w-[3.5rem] flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-all duration-200",
                active
                  ? "text-amber-300"
                  : "text-slate-500 active:text-slate-300",
              ].join(" ")}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-b bg-amber-400" />
              )}
            </button>
          );
        })}
        {/* More button — only shown if there are overflow tabs */}
        {visibleTabs.some((t) => ["alerts", "community", "settings"].includes(t.id)) && (
          <button
            onClick={() => setShowMoreMenu((v) => !v)}
            className={[
              "relative flex min-w-[3.5rem] flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-all duration-200",
              showMoreMenu || ["alerts", "community", "settings"].includes(activeTab)
                ? "text-amber-300"
                : "text-slate-500 active:text-slate-300",
            ].join(" ")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="5" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="19" r="1.5" fill="currentColor" />
            </svg>
            <span>More</span>
            {(showMoreMenu || ["alerts", "community", "settings"].includes(activeTab)) && (
              <span className="absolute top-0 h-0.5 w-8 rounded-b bg-amber-400" />
            )}
          </button>
        )}
      </nav>

      {/* Mobile "More" slide-up menu */}
      {showMoreMenu && (
        <>
          <div
            className="sm:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowMoreMenu(false)}
          />
          <div className="sm:hidden fixed bottom-[3.25rem] left-2 right-2 z-50 rounded-xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-xl shadow-2xl safe-area-bottom animate-slide-in">
            {visibleTabs.filter((t) => ["alerts", "community", "settings"].includes(t.id)).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { handleTabChange(tab.id); setShowMoreMenu(false); }}
                  className={[
                    "flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-150",
                    active
                      ? "text-amber-300 bg-amber-500/10"
                      : "text-slate-300 hover:bg-slate-800/60",
                  ].join(" ")}
                >
                  {tab.id === "alerts" ? (
                    <AlertBellBadge count={alertCount} />
                  ) : (
                    tab.icon
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Changelog modal */}
      {showChangelog && <Changelog onClose={() => setShowChangelog(false)} />}

      {/* Onboarding wizard — skipped in favor of the cleaner landing splash */}

      {/* User Profile panel */}
      {showProfile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <UserProfile onClose={() => setShowProfile(false)} />
          </div>
        </div>
      )}

      {/* Activity Feed slide-in panel */}
      {showActivityFeed && (
        <div className="absolute inset-0 z-50 flex justify-end">
          <div className="flex-1" onClick={() => setShowActivityFeed(false)} />
          <div className="w-full max-w-sm h-full bg-slate-950/[0.97] backdrop-blur-xl border-l border-slate-800/60 animate-slide-in-right overflow-y-auto">
            <ActivityFeed onClose={() => setShowActivityFeed(false)} />
          </div>
        </div>
      )}

    </div>
  );
}
