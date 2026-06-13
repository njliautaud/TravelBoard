/** Restore the Zambia rafting wish wiped by prisma db seed. Run: node scripts/restore-zambia.mjs */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function searchCoverImage(query) {
  try {
    const wikiRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, "_"))}`,
      { headers: { Accept: "application/json" } }
    );
    if (wikiRes.ok) {
      const data = await wikiRes.json();
      const thumb = data?.thumbnail?.source ?? data?.originalimage?.source;
      if (typeof thumb === "string" && thumb.startsWith("http")) return thumb;
    }
  } catch {
    /* ok */
  }
  return null;
}

const user = await prisma.user.findUnique({ where: { username: "swann" } });
if (!user) {
  console.error('User "swann" not found');
  process.exit(1);
}

const existing = await prisma.location.findFirst({
  where: {
    userId: user.id,
    activityName: { contains: "Zambezi", mode: "insensitive" },
  },
});
if (existing) {
  console.log("Already exists:", existing.activityName);
  await prisma.$disconnect();
  process.exit(0);
}

const activityName = "White water raft the Zambezi River";
const coverImageUrl = await searchCoverImage("Victoria Falls");

const loc = await prisma.location.create({
  data: {
    userId: user.id,
    activityName,
    countryCode: "ZMB",
    countryName: "Zambia",
    region: "Southern Province",
    city: "Livingstone",
    latitude: -17.9244,
    longitude: 25.8572,
    status: "TO_VISIT",
    seasonWinter: true,
    seasonSpring: true,
    coverImageUrl,
    notes: "Batoka Gorge below Victoria Falls — classic Zambezi rafting.",
  },
});

console.log("Restored:", loc.activityName, coverImageUrl ? "(with cover image)" : "");
await prisma.$disconnect();
