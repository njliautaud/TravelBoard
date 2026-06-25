"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  requirement: string;
}

interface Progress {
  userId: string;
  totalPoints: number;
  level: number;
  badges: string[];
  badgeEarnedAt: Record<string, string>;
  streakDays: number;
  longestStreak: number;
  nextLevel: number;
  xpToNext: number;
  badgeCatalog: Badge[];
  totalSearches: number;
  totalShares: number;
  countriesVisited: string[];
  journalEntries: number;
}

const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-700 to-amber-900 text-amber-200",
  silver: "from-slate-400 to-slate-600 text-slate-100",
  gold: "from-yellow-400 to-yellow-600 text-yellow-950",
  platinum: "from-cyan-300 to-cyan-500 text-cyan-950",
};

const TIER_BORDER: Record<string, string> = {
  bronze: "border-amber-700/50",
  silver: "border-slate-500/50",
  gold: "border-yellow-500/50",
  platinum: "border-cyan-400/50",
};

const ICON_MAP: Record<string, string> = {
  piggy_bank: "\u{1F416}",
  money_bag: "\u{1F4B0}",
  trophy: "\u{1F3C6}",
  crown: "\u{1F451}",
  airplane: "\u2708\uFE0F",
  globe: "\u{1F30D}",
  world_map: "\u{1F5FA}\uFE0F",
  compass: "\u{1F9ED}",
  star: "\u2B50",
  eye: "\u{1F441}\uFE0F",
  crystal_ball: "\u{1F52E}",
  target: "\u{1F3AF}",
  magic_wand: "\u{1FA84}",
  handshake: "\u{1F91D}",
  pencil: "\u270F\uFE0F",
  clipboard: "\u{1F4CB}",
  book: "\u{1F4D6}",
  megaphone: "\u{1F4E3}",
  fire: "\u{1F525}",
  flame: "\u{1F525}",
  calendar: "\u{1F4C5}",
  hundred: "\u{1F4AF}",
  birthday: "\u{1F382}",
};

function badgeIcon(icon: string): string {
  return ICON_MAP[icon] ?? "\u{1F3C5}";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GamificationPanel() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gamification/progress");
      const data = await res.json();
      if (data.progress) setProgress(data.progress);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Loading achievements...
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 p-6">
        <p className="text-sm text-slate-400">Sign in to track your travel achievements.</p>
      </div>
    );
  }

  const earnedSet = new Set(progress.badges);
  const xpProgress = progress.xpToNext > 0
    ? ((500 - progress.xpToNext) / 500) * 100
    : 100;

  const categories = ["all", ...new Set(progress.badgeCatalog.map((b) => b.category))];
  const filteredBadges = filterCategory === "all"
    ? progress.badgeCatalog
    : progress.badgeCatalog.filter((b) => b.category === filterCategory);

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">Achievements</h2>
        <p className="text-xs text-slate-500">Track your travel milestones and earn badges</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Level & XP Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Level</div>
                <div className="text-3xl font-bold text-amber-400">{progress.level}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">{progress.totalPoints} XP</div>
                <div className="text-xs text-slate-500">{progress.xpToNext} XP to level {progress.nextLevel}</div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-center">
              <div className="text-xl font-bold text-amber-400">{progress.streakDays}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Streak</div>
            </div>
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-center">
              <div className="text-xl font-bold text-amber-400">{progress.badges.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Badges</div>
            </div>
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-center">
              <div className="text-xl font-bold text-amber-400">{progress.countriesVisited?.length ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Countries</div>
            </div>
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-center">
              <div className="text-xl font-bold text-amber-400">{progress.journalEntries ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Entries</div>
            </div>
          </div>

          {/* Streak Info */}
          {progress.streakDays > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <span className="text-2xl">{"\u{1F525}"}</span>
              <div>
                <div className="text-sm font-medium text-amber-300">{progress.streakDays}-day streak!</div>
                <div className="text-xs text-slate-500">Longest: {progress.longestStreak} days</div>
              </div>
            </div>
          )}

          {/* Badge Catalog */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Badge Collection</h3>

            {/* Category filter */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                    filterCategory === cat
                      ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                      : "bg-slate-800 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredBadges.map((badge) => {
                const earned = earnedSet.has(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`rounded-xl border p-3 transition ${
                      earned
                        ? `${TIER_BORDER[badge.tier]} bg-slate-900/80`
                        : "border-slate-800/50 bg-slate-900/30 opacity-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg ${
                          earned ? TIER_COLORS[badge.tier] : "from-slate-700 to-slate-800 text-slate-500"
                        }`}
                      >
                        {badgeIcon(badge.icon)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-200">{badge.name}</span>
                          {earned && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{badge.description}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`text-[10px] font-medium uppercase tracking-wider ${
                            earned ? "text-amber-400" : "text-slate-600"
                          }`}>
                            {badge.tier}
                          </span>
                          {earned && progress.badgeEarnedAt[badge.id] && (
                            <span className="text-[10px] text-slate-600">
                              Earned {new Date(progress.badgeEarnedAt[badge.id]!).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
