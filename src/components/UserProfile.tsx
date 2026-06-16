"use client";

/**
 * Phase 3 — User Profile panel.
 * Shows travel stats, trip count, badges, saved deals count.
 * Integrates with Clerk auth for identity and Prisma for travel data.
 */

import { useEffect, useState } from "react";

interface ProfileStats {
  tripCount: number;
  countriesVisited: number;
  journalEntries: number;
  savedDeals: number;
  totalPoints: number;
  level: number;
  badges: string[];
  memberSince: string;
  username: string;
  email: string | null;
  homeAirports: string[];
}

const LEVEL_TITLES: Record<number, string> = {
  1: "Rookie Traveler",
  2: "Weekend Warrior",
  3: "Frequent Flyer",
  4: "Globe Trotter",
  5: "World Explorer",
  6: "Travel Master",
  7: "Jet Setter",
  8: "Travel Legend",
};

function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, 8)] ?? "Travel Legend";
}

export default function UserProfile({ onClose }: { onClose?: () => void }) {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setStats)
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-lg">
        <p className="text-sm text-slate-400 animate-pulse">Loading profile...</p>
      </div>
    );
  }

  if (err || !stats) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-lg text-center">
        <p className="text-sm text-slate-400">Sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-lg">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-100">{stats.username}</h3>
            {stats.email && (
              <p className="mt-0.5 text-xs text-slate-500">{stats.email}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                Level {stats.level}
              </span>
              <span className="text-xs text-slate-400">{getLevelTitle(stats.level)}</span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* XP progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{stats.totalPoints} XP</span>
            <span>{stats.level * 500} XP to next level</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
              style={{ width: `${Math.min(100, (stats.totalPoints % 500) / 5)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: stats.tripCount, label: "Trips", icon: "\u2708" },
          { value: stats.countriesVisited, label: "Countries", icon: "\uD83C\uDF0D" },
          { value: stats.journalEntries, label: "Journal entries", icon: "\uD83D\uDCD6" },
          { value: stats.savedDeals, label: "Saved deals", icon: "\u2764" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center rounded-xl border border-slate-800 bg-slate-900/60 p-3 backdrop-blur-lg"
          >
            <span className="text-xl">{s.icon}</span>
            <span className="mt-1 text-lg font-bold text-slate-100">{s.value}</span>
            <span className="text-[10px] text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Badges */}
      {stats.badges.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Badges
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Home airports & member since */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-lg">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Home airports</span>
          <span className="font-medium text-slate-200">
            {stats.homeAirports.length > 0 ? stats.homeAirports.join(", ") : "Not set"}
          </span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-slate-400">Member since</span>
          <span className="font-medium text-slate-200">
            {new Date(stats.memberSince).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </span>
        </div>
      </div>
    </div>
  );
}
