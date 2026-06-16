#!/usr/bin/env node

/**
 * cache-warm.mjs — Standalone fare cache warming script.
 *
 * Warms the fare cache by calling the /api/fares/warm endpoint for each
 * configured origin airport and each month. Designed to be run via cron.
 *
 * Usage:
 *   node scripts/cache-warm.mjs
 *   node scripts/cache-warm.mjs --origins MCO,JFK,LAX
 *   node scripts/cache-warm.mjs --months 0,1,2
 *
 * Environment:
 *   TRAVELBOARD_API  — base URL (default: http://localhost:3000)
 *   CACHE_WARM_TOKEN — session cookie value for auth (required)
 *
 * Cron example (warm all origins every 6 hours):
 *   0 * /6 * * * CACHE_WARM_TOKEN=xxx node /path/to/scripts/cache-warm.mjs
 */

const BASE_URL = process.env.TRAVELBOARD_API || "http://localhost:3000";
const TOKEN = process.env.CACHE_WARM_TOKEN || "";

// Default origins — override with --origins flag
const DEFAULT_ORIGINS = ["MCO", "JFK", "LAX", "ORD", "SFO", "MIA", "ATL", "DFW"];

function parseArgs() {
  const args = process.argv.slice(2);
  let origins = DEFAULT_ORIGINS;
  let months = Array.from({ length: 12 }, (_, i) => i); // 0-11

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--origins" && args[i + 1]) {
      origins = args[i + 1].split(",").map((s) => s.trim().toUpperCase());
      i++;
    }
    if (args[i] === "--months" && args[i + 1]) {
      months = args[i + 1].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 0 && n <= 11);
      i++;
    }
  }

  return { origins, months };
}

async function warmOne(origin, month) {
  const url = `${BASE_URL}/api/fares/warm`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `tb_session=${TOKEN}`,
    },
    body: JSON.stringify({ origin, month }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { origin, month, ok: false, error: data.error ?? res.statusText };
  }
  return { origin, month, ok: true, count: data.count ?? 0 };
}

async function main() {
  const { origins, months } = parseArgs();

  if (!TOKEN) {
    console.error(
      "ERROR: CACHE_WARM_TOKEN env var is required.\n" +
      "Set it to a valid tb_session cookie value from an authenticated session."
    );
    process.exit(1);
  }

  console.log(`Cache warming: ${origins.length} origins x ${months.length} months`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Origins: ${origins.join(", ")}`);
  console.log("");

  let total = 0;
  let errors = 0;

  for (const origin of origins) {
    for (const month of months) {
      try {
        const result = await warmOne(origin, month);
        if (result.ok) {
          total += result.count ?? 0;
          console.log(`  ${origin} month=${month}: ${result.count} fares cached`);
        } else {
          errors++;
          console.error(`  ${origin} month=${month}: ERROR - ${result.error}`);
        }
      } catch (err) {
        errors++;
        console.error(`  ${origin} month=${month}: FETCH ERROR - ${err.message}`);
      }

      // Small delay to avoid hammering the provider
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("");
  console.log(`Done. ${total} total fares cached, ${errors} errors.`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
