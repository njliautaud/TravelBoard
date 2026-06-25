// One-shot migration for the Supabase Auth switchover (2026-06-25).
//
// Keeps `swann` (-> OWNER, legoewokninja@gmail.com) and `billyisgay`
// (-> masonpace1@gmail.com) with all their travel data; their existing Prisma
// rows get an `email` so that the first time that email signs in via Supabase
// Auth, getSessionUser() claims the row (sets authId). Everyone else (william,
// nick, devingator) is deleted — onDelete: Cascade removes their locations,
// friendships, drafts and notifications too. Idempotent.
//
// A full logical backup must be taken first (scripts/export-db-backup.mjs).
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

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

const prisma = new PrismaClient();

const KEEP = [
  { username: "swann", email: "legoewokninja@gmail.com", role: "OWNER" },
  { username: "billyisgay", email: "masonpace1@gmail.com", role: "EDITOR" },
];
const DELETE = ["william", "nick", "devingator"];

const before = await prisma.user.findMany({ select: { username: true, role: true, email: true } });
console.log("Before:", JSON.stringify(before));

for (const k of KEEP) {
  const updated = await prisma.user.update({
    where: { username: k.username },
    data: { email: k.email, role: k.role },
    select: { username: true, email: true, role: true },
  });
  console.log("Kept/updated:", JSON.stringify(updated));
}

const del = await prisma.user.deleteMany({ where: { username: { in: DELETE } } });
console.log(`Deleted ${del.count} users (cascade removed their locations/friendships/drafts/notifications)`);

const after = await prisma.user.findMany({ select: { username: true, role: true, email: true, authId: true } });
console.log("After:", JSON.stringify(after, null, 2));

await prisma.$disconnect();
