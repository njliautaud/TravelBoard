// Version-independent logical backup of the whole DB via Prisma.
// Writes one timestamped JSON file under backups/ with every row of every model.
// Used because the local pg_dump (16.x) can't dump the Neon server (PG 17).
// Bytes columns (StoredImage.bytes) are base64-encoded; Decimal/DateTime are
// serialized via their toJSON (string / ISO). Restorable by a matching import.
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Minimal .env loader (no dotenv dependency): pull DATABASE_URL for the client.
try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
} catch {
  console.error("Could not read .env"); process.exit(1);
}

const prisma = new PrismaClient();

// Order matters for a later restore (parents before children).
const MODELS = [
  "user", "friendship", "notification", "location", "media",
  "flightPrice", "draft", "storedImage", "imageCache",
];

function replacer(_key, value) {
  // Prisma returns Bytes as a Uint8Array (no toJSON) — base64 it so JSON stays
  // valid & compact instead of a giant numeric-keyed object.
  if (value instanceof Uint8Array) {
    return { __bytes_b64__: Buffer.from(value).toString("base64") };
  }
  if (value && value.type === "Buffer" && Array.isArray(value.data)) {
    return { __bytes_b64__: Buffer.from(value.data).toString("base64") };
  }
  return value;
}

const out = { exportedAt: new Date().toISOString(), database: "supabase", counts: {}, data: {} };
for (const m of MODELS) {
  const rows = await prisma[m].findMany();
  out.data[m] = rows;
  out.counts[m] = rows.length;
}

mkdirSync("backups", { recursive: true });
const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14); // YYYYMMDDHHMMSS
const file = join("backups", `travelboard-data-${ts}.json`);
writeFileSync(file, JSON.stringify(out, replacer, 2), "utf8");

console.log("Backup written:", file);
console.log("Row counts:", JSON.stringify(out.counts));
await prisma.$disconnect();
