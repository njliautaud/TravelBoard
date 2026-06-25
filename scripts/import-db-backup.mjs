// Load a JSON backup (from export-db-backup.mjs) into the DB the Prisma client
// currently points at. Intended target: a FRESH Supabase DB whose schema was
// already built by `prisma migrate deploy` (never `migrate dev`).
//
//   node scripts/import-db-backup.mjs backups/travelboard-data-YYYYMMDDHHMMSS.json
//
// Safe to re-run: each model uses createMany({ skipDuplicates: true }) so rows
// already present (matched by primary key) are skipped, not duplicated.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-db-backup.mjs <backup.json>");
  process.exit(1);
}

// Minimal .env loader so the script can run standalone (mirrors the exporter).
try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
} catch {
  console.error("Could not read .env"); process.exit(1);
}

const backup = JSON.parse(readFileSync(file, "utf8"));
const prisma = new PrismaClient();

// Parents before children (FK order). Must match the exporter.
const MODELS = ["user", "friendship", "notification", "location", "media", "flightPrice", "draft", "storedImage", "imageCache"];

// Rebuild Buffers for the Bytes column. Handles both serialized shapes:
//   { __bytes_b64__: "..." }            (base64 — newer exports)
//   { "0": 217, "1": 3, ... }           (numeric-keyed — Uint8Array via JSON)
function reviveBytes(v) {
  if (!v || typeof v !== "object") return v;
  if (typeof v.__bytes_b64__ === "string") return Buffer.from(v.__bytes_b64__, "base64");
  const keys = Object.keys(v);
  if (keys.length && keys.every((k) => /^\d+$/.test(k))) {
    const ordered = keys.map(Number).sort((a, b) => a - b).map((k) => v[k]);
    return Buffer.from(ordered);
  }
  return v;
}

function revive(rows) {
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      // Only the Bytes column needs Buffer reconstruction; leave JSON columns alone.
      out[k] = k === "bytes" ? reviveBytes(v) : v;
    }
    return out;
  });
}

console.log("Importing from:", file, "(exported", backup.exportedAt + ")");
for (const m of MODELS) {
  const rows = revive(backup.data[m] ?? []);
  if (rows.length === 0) { console.log(`  ${m}: 0 (skip)`); continue; }
  const res = await prisma[m].createMany({ data: rows, skipDuplicates: true });
  console.log(`  ${m}: ${res.count}/${rows.length} inserted`);
}

console.log("Done. Verify counts against the backup before switching .env.");
await prisma.$disconnect();
