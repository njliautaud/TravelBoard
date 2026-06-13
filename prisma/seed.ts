import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const reset = process.env.TRAVELBOARD_SEED_RESET === "1";
  const passwordHash = await bcrypt.hash("asdf", 10);

  const user = await prisma.user.upsert({
    where: { username: "swann" },
    create: { username: "swann", passwordHash },
    update: reset ? { passwordHash } : {},
  });

  const existingCount = await prisma.location.count({ where: { userId: user.id } });
  if (existingCount > 0 && !reset) {
    console.log(`User "swann" already has ${existingCount} locations — skipping seed (set TRAVELBOARD_SEED_RESET=1 to wipe and re-seed)`);
    return;
  }

  await prisma.draft.deleteMany({ where: { userId: user.id } });
  await prisma.flightPrice.deleteMany({ where: { location: { userId: user.id } } });
  await prisma.media.deleteMany({ where: { location: { userId: user.id } } });
  await prisma.location.deleteMany({ where: { userId: user.id } });

  const inThreeYears = new Date();
  inThreeYears.setFullYear(inThreeYears.getFullYear() + 3);

  await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Hike the Hall of Mosses, Hoh Rainforest",
      countryCode: "USA",
      countryName: "United States",
      region: "Washington",
      city: "Forks",
      latitude: 47.8607,
      longitude: -123.9348,
      status: "TO_VISIT",
      seasonSummer: true,
      coverImageUrl: "https://picsum.photos/seed/hoh/800/500",
      notes:
        "Temperate rainforest in Olympic National Park. Go in late spring for the greenest moss.",
      media: {
        create: [
          { type: "IMAGE_URL", url: "https://picsum.photos/seed/hoh/800/500", caption: "Hall of Mosses" },
          { type: "LINK", url: "https://www.nps.gov/olym/planyourvisit/visiting-the-hoh.htm", caption: "NPS visitor info" },
        ],
      },
    },
  });

  await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Watch geysers at Yellowstone",
      countryCode: "USA",
      countryName: "United States",
      region: "Wyoming",
      latitude: 44.4605,
      longitude: -110.8281,
      status: "TO_VISIT",
      seasonSummer: true,
      coverImageUrl: "https://picsum.photos/seed/yellowstone/800/500",
      media: { create: [{ type: "IMAGE_URL", url: "https://picsum.photos/seed/yellowstone/800/500" }] },
    },
  });

  await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Photograph Antelope Canyon",
      countryCode: "USA",
      countryName: "United States",
      region: "Arizona",
      city: "Page",
      latitude: 36.8619,
      longitude: -111.3743,
      status: "TO_VISIT",
      seasonSpring: true,
      seasonFall: true,
    },
  });

  await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Trek Son Doong Cave",
      countryCode: "VNM",
      countryName: "Vietnam",
      region: "Quang Binh",
      city: "Phong Nha",
      latitude: 17.4563,
      longitude: 106.2873,
      status: "TO_VISIT",
      reminderAt: inThreeYears,
      seasonWinter: true,
      notes: "World's largest cave. Reminder set to book in 3 years.",
      media: {
        create: [{ type: "LINK", url: "https://oxalisadventure.com/cave/son-doong-cave/", caption: "Oxalis" }],
      },
    },
  });

  await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Sunrise at Mount Bromo",
      countryCode: "IDN",
      countryName: "Indonesia",
      region: "East Java",
      city: "Probolinggo",
      latitude: -7.9425,
      longitude: 112.953,
      status: "TO_VISIT",
      seasonSummer: true,
      coverImageUrl: "https://picsum.photos/seed/bromo/800/500",
      media: { create: [{ type: "IMAGE_URL", url: "https://picsum.photos/seed/bromo/800/500" }] },
    },
  });

  await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Dive Raja Ampat",
      countryCode: "IDN",
      countryName: "Indonesia",
      region: "West Papua",
      latitude: -0.2346,
      longitude: 130.5079,
      status: "TO_VISIT",
      seasonWinter: true,
      seasonSpring: true,
    },
  });

  const machu = await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Hike the Inca Trail to Machu Picchu",
      countryCode: "PER",
      countryName: "Peru",
      region: "Cusco",
      city: "Aguas Calientes",
      latitude: -13.1631,
      longitude: -72.545,
      status: "TO_VISIT",
      priceThreshold: 650,
      seasonSummer: true,
      starred: true,
      coverImageUrl: "https://picsum.photos/seed/machu/800/500",
      notes: "Watching for flight deals under $650.",
      media: { create: [{ type: "IMAGE_URL", url: "https://picsum.photos/seed/machu/800/500" }] },
    },
  });

  await prisma.flightPrice.create({
    data: {
      locationId: machu.id,
      price: 589,
      currency: "USD",
      origin: "SEA",
      destination: "CUZ",
      source: "seed",
    },
  });

  await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Temple-hop in Kyoto",
      countryCode: "JPN",
      countryName: "Japan",
      region: "Kansai",
      city: "Kyoto",
      latitude: 35.0116,
      longitude: 135.7681,
      status: "VISITED",
      seasonSpring: true,
      seasonFall: true,
      coverImageUrl: "https://picsum.photos/seed/kyoto/800/500",
      media: { create: [{ type: "IMAGE_URL", url: "https://picsum.photos/seed/kyoto/800/500" }] },
    },
  });

  await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Sail the caldera in Santorini",
      countryCode: "GRC",
      countryName: "Greece",
      region: "South Aegean",
      city: "Oia",
      latitude: 36.4618,
      longitude: 25.3753,
      status: "TO_VISIT",
      seasonSummer: true,
    },
  });

  await prisma.location.create({
    data: {
      userId: user.id,
      activityName: "Canoe on Moraine Lake, Banff",
      countryCode: "CAN",
      countryName: "Canada",
      region: "Alberta",
      city: "Banff",
      latitude: 51.3217,
      longitude: -116.186,
      status: "TO_VISIT",
      seasonSummer: true,
    },
  });

  await prisma.draft.create({
    data: {
      userId: user.id,
      rawText: "Check this reel https://www.instagram.com/reel/example/",
      extractedUrl: "https://www.instagram.com/reel/example/",
      source: "whatsapp",
    },
  });

  console.log(`Seeded user "swann" (password: asdf) with ${await prisma.location.count()} locations`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
