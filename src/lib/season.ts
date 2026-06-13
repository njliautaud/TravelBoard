import type { LocationItem } from "./types";

const TROPIC = 23.5;

function currentSeason(now: Date): "spring" | "summer" | "fall" | "winter" {
  const m = now.getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

function hasSeasonPrefs(loc: LocationItem): boolean {
  return loc.seasonSpring || loc.seasonSummer || loc.seasonFall || loc.seasonWinter;
}

/** True when the location matches the user's chosen season(s), or hemisphere heuristic if none set. */
export function isInSeason(loc: LocationItem, now = new Date()): boolean {
  if (hasSeasonPrefs(loc)) {
    const s = currentSeason(now);
    if (s === "spring") return loc.seasonSpring;
    if (s === "summer") return loc.seasonSummer;
    if (s === "fall") return loc.seasonFall;
    return loc.seasonWinter;
  }
  const m = now.getMonth();
  const northSummer = m >= 4 && m <= 8;
  const southSummer = m >= 10 || m <= 2;
  if (loc.latitude > TROPIC) return northSummer;
  if (loc.latitude < -TROPIC) return southSummer;
  return true;
}

export function seasonScore(loc: LocationItem, now = new Date()): number {
  let score = 0;
  if (loc.isDeal) score += 3;
  if (loc.reminderAt) {
    const daysAway = (new Date(loc.reminderAt).getTime() - now.getTime()) / 86_400_000;
    if (daysAway <= 60) score += 2;
  }
  if (isInSeason(loc, now)) {
    score += hasSeasonPrefs(loc) ? 1.5 : Math.abs(loc.latitude) > TROPIC ? 1 : 0.5;
  }
  if (loc.status === "VISITED") score -= 5;
  return score;
}

export function sortBySeason(locations: LocationItem[], now = new Date()): LocationItem[] {
  return locations
    .slice()
    .sort(
      (a, b) =>
        Number(b.starred) - Number(a.starred) ||
        seasonScore(b, now) - seasonScore(a, now) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}
