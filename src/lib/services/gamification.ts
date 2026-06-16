/**
 * Gamification service — badges, XP, levels, streaks.
 *
 * Adapted from Meridian's gamification.ts to use Prisma/PostgreSQL.
 * Tracks user engagement and awards badges for travel milestones.
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Badge Definitions
// ---------------------------------------------------------------------------

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "savings" | "exploration" | "skill" | "social" | "milestone";
  tier: "bronze" | "silver" | "gold" | "platinum";
  requirement: string;
}

export const BADGE_CATALOG: Badge[] = [
  // Savings
  { id: "first_save", name: "First Save", description: "Found your first deal below target price", icon: "piggy_bank", category: "savings", tier: "bronze", requirement: "Save on 1 deal" },
  { id: "penny_pincher", name: "Penny Pincher", description: "Saved $500+ across all deals", icon: "money_bag", category: "savings", tier: "silver", requirement: "Accumulate $500 in savings" },
  { id: "deal_master", name: "Deal Master", description: "Saved $2,000+ across all deals", icon: "trophy", category: "savings", tier: "gold", requirement: "Accumulate $2,000 in savings" },
  { id: "savings_legend", name: "Savings Legend", description: "Saved $5,000+ across all deals", icon: "crown", category: "savings", tier: "platinum", requirement: "Accumulate $5,000 in savings" },
  // Exploration
  { id: "first_flight", name: "First Flight", description: "Tracked your first trip", icon: "airplane", category: "exploration", tier: "bronze", requirement: "Add 1 trip" },
  { id: "five_countries", name: "Five Countries", description: "Visited 5 countries", icon: "globe", category: "exploration", tier: "silver", requirement: "Visit 5 countries" },
  { id: "ten_countries", name: "Ten Countries", description: "Visited 10 countries", icon: "world_map", category: "exploration", tier: "gold", requirement: "Visit 10 countries" },
  { id: "quarter_century", name: "25 Countries", description: "Visited 25 countries", icon: "compass", category: "exploration", tier: "platinum", requirement: "Visit 25 countries" },
  { id: "half_century", name: "50 Countries", description: "Visited 50 countries", icon: "star", category: "exploration", tier: "platinum", requirement: "Visit 50 countries" },
  // Skill
  { id: "sharp_eye", name: "Sharp Eye", description: "Found an A-grade deal", icon: "eye", category: "skill", tier: "bronze", requirement: "Find an A-grade deal" },
  { id: "price_prophet", name: "Price Prophet", description: "Set 5+ price alerts that triggered", icon: "crystal_ball", category: "skill", tier: "silver", requirement: "5 price alerts triggered" },
  { id: "deal_sniper", name: "Deal Sniper", description: "Found a deal 40%+ below baseline", icon: "target", category: "skill", tier: "gold", requirement: "Find a 40% off deal" },
  { id: "fare_wizard", name: "Fare Wizard", description: "Used fare prediction and found a cheaper flight", icon: "magic_wand", category: "skill", tier: "platinum", requirement: "Beat fare prediction" },
  // Social
  { id: "first_share", name: "First Share", description: "Shared your first deal", icon: "handshake", category: "social", tier: "bronze", requirement: "Share 1 deal" },
  { id: "journal_starter", name: "Journal Starter", description: "Wrote your first journal entry", icon: "pencil", category: "social", tier: "bronze", requirement: "Write 1 journal entry" },
  { id: "board_creator", name: "Board Creator", description: "Created a social board", icon: "clipboard", category: "social", tier: "silver", requirement: "Create a social board" },
  { id: "storyteller", name: "Storyteller", description: "Wrote 10 journal entries", icon: "book", category: "social", tier: "gold", requirement: "Write 10 journal entries" },
  { id: "travel_influencer", name: "Travel Influencer", description: "Shared 20+ deals", icon: "megaphone", category: "social", tier: "platinum", requirement: "Share 20 deals" },
  // Milestone
  { id: "streak_3", name: "3-Day Streak", description: "Active for 3 consecutive days", icon: "fire", category: "milestone", tier: "bronze", requirement: "Be active 3 days in a row" },
  { id: "streak_7", name: "Week Warrior", description: "Active for 7 consecutive days", icon: "flame", category: "milestone", tier: "silver", requirement: "Be active 7 days in a row" },
  { id: "streak_30", name: "Monthly Master", description: "Active for 30 consecutive days", icon: "calendar", category: "milestone", tier: "gold", requirement: "Be active 30 days in a row" },
  { id: "centurion", name: "Centurion", description: "Searched for 100+ deals", icon: "hundred", category: "milestone", tier: "gold", requirement: "Search 100 times" },
];

// ---------------------------------------------------------------------------
// Progress types
// ---------------------------------------------------------------------------

export interface UserProgress {
  userId: string;
  totalPoints: number;
  level: number;
  badges: string[];
  badgeEarnedAt: Record<string, string>;
  streakDays: number;
  longestStreak: number;
  lastActivityDate: string | null;
  totalSearches: number;
  totalShares: number;
  totalSavings: number;
  totalAlertsTriggered: number;
  countriesVisited: string[];
  journalEntries: number;
  boardsCreated: number;
  bestDealDiscount: number;
}

export interface ProgressResponse extends UserProgress {
  nextLevel: number;
  xpToNext: number;
  badgeCatalog: Badge[];
}

const XP_PER_LEVEL = 500;
const XP_SEARCH = 5;
const XP_DEAL_FOUND = 15;
const XP_SHARE = 25;
const XP_TRIP_ADDED = 30;
const XP_JOURNAL = 20;
const XP_BADGE = 100;
const XP_STREAK_DAY = 10;

function computeLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayDiff(d1: string, d2: string): number {
  const ms1 = new Date(d1).getTime();
  const ms2 = new Date(d2).getTime();
  return Math.round((ms2 - ms1) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Load / save extended progress from GamificationProgress model
// ---------------------------------------------------------------------------

function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

interface ExtendedData {
  badgeEarnedAt: Record<string, string>;
  longestStreak: number;
  lastActivityDate: string | null;
  totalSearches: number;
  totalShares: number;
  totalSavings: number;
  totalAlertsTriggered: number;
  countriesVisited: string[];
  journalEntries: number;
  boardsCreated: number;
  bestDealDiscount: number;
}

async function loadProgress(userId: string): Promise<UserProgress> {
  const row = await prisma.gamificationProgress.findUnique({ where: { userId } });
  if (!row) {
    return {
      userId,
      totalPoints: 0,
      level: 1,
      badges: [],
      badgeEarnedAt: {},
      streakDays: 0,
      longestStreak: 0,
      lastActivityDate: null,
      totalSearches: 0,
      totalShares: 0,
      totalSavings: 0,
      totalAlertsTriggered: 0,
      countriesVisited: [],
      journalEntries: 0,
      boardsCreated: 0,
      bestDealDiscount: 0,
    };
  }

  const badges = safeJsonParse<string[]>(row.badges, []);
  // Store extended data as part of the badges JSON field as { badges: [...], ext: {...} }
  // Or use a separate approach: we store extended data in the badges field as JSON
  const rawParsed = safeJsonParse<{ badges?: string[]; ext?: ExtendedData }>(row.badges, {});
  const badgeList = rawParsed.badges ?? (Array.isArray(badges) ? badges : []);
  const ext = rawParsed.ext ?? {
    badgeEarnedAt: {},
    longestStreak: 0,
    lastActivityDate: null,
    totalSearches: 0,
    totalShares: 0,
    totalSavings: 0,
    totalAlertsTriggered: 0,
    countriesVisited: [],
    journalEntries: 0,
    boardsCreated: 0,
    bestDealDiscount: 0,
  };

  return {
    userId,
    totalPoints: row.totalPoints,
    level: row.level,
    badges: badgeList,
    badgeEarnedAt: ext.badgeEarnedAt,
    streakDays: row.streakDays,
    longestStreak: ext.longestStreak,
    lastActivityDate: ext.lastActivityDate ?? (row.lastActivityAt?.toISOString().slice(0, 10) ?? null),
    totalSearches: ext.totalSearches,
    totalShares: ext.totalShares,
    totalSavings: ext.totalSavings,
    totalAlertsTriggered: ext.totalAlertsTriggered,
    countriesVisited: ext.countriesVisited,
    journalEntries: ext.journalEntries,
    boardsCreated: ext.boardsCreated,
    bestDealDiscount: ext.bestDealDiscount,
  };
}

async function saveProgress(p: UserProgress): Promise<void> {
  const badgesJson = JSON.stringify({
    badges: p.badges,
    ext: {
      badgeEarnedAt: p.badgeEarnedAt,
      longestStreak: p.longestStreak,
      lastActivityDate: p.lastActivityDate,
      totalSearches: p.totalSearches,
      totalShares: p.totalShares,
      totalSavings: p.totalSavings,
      totalAlertsTriggered: p.totalAlertsTriggered,
      countriesVisited: p.countriesVisited,
      journalEntries: p.journalEntries,
      boardsCreated: p.boardsCreated,
      bestDealDiscount: p.bestDealDiscount,
    } satisfies ExtendedData,
  });

  await prisma.gamificationProgress.upsert({
    where: { userId: p.userId },
    create: {
      userId: p.userId,
      totalPoints: p.totalPoints,
      level: p.level,
      badges: badgesJson,
      streakDays: p.streakDays,
      lastActivityAt: p.lastActivityDate ? new Date(p.lastActivityDate) : null,
    },
    update: {
      totalPoints: p.totalPoints,
      level: p.level,
      badges: badgesJson,
      streakDays: p.streakDays,
      lastActivityAt: p.lastActivityDate ? new Date(p.lastActivityDate) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Badge evaluation
// ---------------------------------------------------------------------------

function evaluateBadges(p: UserProgress): string[] {
  const earned: string[] = [];

  // Savings
  if (p.totalSavings > 0) earned.push("first_save");
  if (p.totalSavings >= 500) earned.push("penny_pincher");
  if (p.totalSavings >= 2000) earned.push("deal_master");
  if (p.totalSavings >= 5000) earned.push("savings_legend");

  // Exploration
  if (p.countriesVisited.length >= 1) earned.push("first_flight");
  if (p.countriesVisited.length >= 5) earned.push("five_countries");
  if (p.countriesVisited.length >= 10) earned.push("ten_countries");
  if (p.countriesVisited.length >= 25) earned.push("quarter_century");
  if (p.countriesVisited.length >= 50) earned.push("half_century");

  // Skill
  if (p.bestDealDiscount >= 0.15) earned.push("sharp_eye");
  if (p.totalAlertsTriggered >= 5) earned.push("price_prophet");
  if (p.bestDealDiscount >= 0.40) earned.push("deal_sniper");
  if (p.totalAlertsTriggered >= 10 && p.bestDealDiscount >= 0.30) earned.push("fare_wizard");

  // Social
  if (p.totalShares >= 1) earned.push("first_share");
  if (p.journalEntries >= 1) earned.push("journal_starter");
  if (p.boardsCreated >= 1) earned.push("board_creator");
  if (p.journalEntries >= 10) earned.push("storyteller");
  if (p.totalShares >= 20) earned.push("travel_influencer");

  // Milestones
  if (p.longestStreak >= 3) earned.push("streak_3");
  if (p.longestStreak >= 7) earned.push("streak_7");
  if (p.longestStreak >= 30) earned.push("streak_30");
  if (p.totalSearches >= 100) earned.push("centurion");

  return earned;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getProgress(userId: string): Promise<ProgressResponse> {
  const p = await loadProgress(userId);
  return {
    ...p,
    level: computeLevel(p.totalPoints),
    nextLevel: computeLevel(p.totalPoints) + 1,
    xpToNext: XP_PER_LEVEL - (p.totalPoints % XP_PER_LEVEL),
    badgeCatalog: BADGE_CATALOG,
  };
}

export function getBadgeCatalog(): Badge[] {
  return BADGE_CATALOG;
}

export type GamificationEvent =
  | { type: "search" }
  | { type: "deal_found"; discount: number }
  | { type: "share" }
  | { type: "trip_added"; country: string }
  | { type: "alert_triggered"; savings: number }
  | { type: "journal_entry" }
  | { type: "board_created" };

export interface GamificationResult {
  xpGained: number;
  newBadges: Badge[];
  streakUpdated: boolean;
  progress: UserProgress;
}

export async function recordEvent(userId: string, event: GamificationEvent): Promise<GamificationResult> {
  const p = await loadProgress(userId);
  let xpGained = 0;
  const oldBadges = new Set(p.badges);

  // Update streak
  const today = todayStr();
  let streakUpdated = false;
  if (p.lastActivityDate && p.lastActivityDate !== today) {
    const diff = dayDiff(p.lastActivityDate, today);
    if (diff === 1) {
      p.streakDays++;
      xpGained += XP_STREAK_DAY;
      streakUpdated = true;
    } else if (diff > 1) {
      p.streakDays = 1;
      streakUpdated = true;
    }
    p.longestStreak = Math.max(p.longestStreak, p.streakDays);
  } else if (!p.lastActivityDate) {
    p.streakDays = 1;
    streakUpdated = true;
  }
  p.lastActivityDate = today;

  // Process event
  switch (event.type) {
    case "search":
      p.totalSearches++;
      xpGained += XP_SEARCH;
      break;
    case "deal_found":
      xpGained += XP_DEAL_FOUND;
      if (event.discount > p.bestDealDiscount) {
        p.bestDealDiscount = event.discount;
      }
      break;
    case "share":
      p.totalShares++;
      xpGained += XP_SHARE;
      break;
    case "trip_added": {
      xpGained += XP_TRIP_ADDED;
      const country = event.country.toUpperCase().slice(0, 3);
      if (!p.countriesVisited.includes(country)) {
        p.countriesVisited.push(country);
      }
      break;
    }
    case "alert_triggered":
      p.totalAlertsTriggered++;
      p.totalSavings += event.savings;
      xpGained += XP_DEAL_FOUND;
      break;
    case "journal_entry":
      p.journalEntries++;
      xpGained += XP_JOURNAL;
      break;
    case "board_created":
      p.boardsCreated++;
      xpGained += XP_SHARE;
      break;
  }

  // Evaluate badges
  const newBadgeIds = evaluateBadges(p);
  const freshBadges: Badge[] = [];
  for (const id of newBadgeIds) {
    if (!oldBadges.has(id)) {
      p.badges.push(id);
      p.badgeEarnedAt[id] = new Date().toISOString();
      xpGained += XP_BADGE;
      const badge = BADGE_CATALOG.find((b) => b.id === id);
      if (badge) freshBadges.push(badge);
    }
  }

  p.totalPoints += xpGained;
  p.level = computeLevel(p.totalPoints);

  await saveProgress(p);

  return { xpGained, newBadges: freshBadges, streakUpdated, progress: p };
}
