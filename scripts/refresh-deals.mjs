#!/usr/bin/env node
/**
 * refresh-deals.mjs — Periodic refresh script for award and cash fare caches.
 *
 * Usage:
 *   node scripts/refresh-deals.mjs [--origin MCO]
 *
 * Run via cron every 12h to keep deal caches fresh:
 *   0 0,12 * * * cd /home/jupiter/TravelBoard && node scripts/refresh-deals.mjs >> /tmp/refresh-deals.log 2>&1
 *
 * Calls POST /api/awards/refresh to:
 *   1. Fetch fresh award data from seats.aero
 *   2. Score and upsert into AwardCache
 *   3. Delete expired entries
 */

const BASE_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
const origin = process.argv.includes("--origin")
  ? process.argv[process.argv.indexOf("--origin") + 1]
  : "MCO";

async function refreshAwards() {
  console.log(`[${new Date().toISOString()}] Refreshing award cache for origin=${origin}...`);
  try {
    const res = await fetch(`${BASE_URL}/api/awards/refresh?origin=${origin}`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`  Awards: ${data.upserted} upserted, ${data.expired_deleted} expired deleted. Next expiry: ${data.next_expiry}`);
    } else {
      console.error(`  Awards refresh failed: ${data.error}`);
    }
  } catch (err) {
    console.error(`  Awards refresh error: ${err.message}`);
  }
}

async function main() {
  await refreshAwards();
  console.log(`[${new Date().toISOString()}] Refresh complete.`);
}

main().catch(console.error);
