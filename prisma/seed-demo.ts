import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Use existing "swann" user
  const user = await prisma.user.findUnique({ where: { username: "swann" } });
  if (!user) throw new Error("No 'swann' user found — run the main seed first");
  const userId = user.id;

  console.log(`Seeding demo data for user "${user.username}" (${userId})...`);

  // ─── TRIPS (visited places for the memory map) ────────────────────────────
  const trips = await Promise.all([
    prisma.trip.create({
      data: {
        userId,
        code: "US",
        city: "New York",
        country: "United States",
        lat: 40.7128,
        lon: -74.006,
        startDate: new Date("2025-11-15"),
        endDate: new Date("2025-11-18"),
        note: "Amazing weekend trip — Broadway, Central Park, and the best pizza of my life.",
        rating: 5,
      },
    }),
    prisma.trip.create({
      data: {
        userId,
        code: "JP",
        city: "Tokyo",
        country: "Japan",
        lat: 35.6762,
        lon: 139.6503,
        startDate: new Date("2026-03-20"),
        endDate: new Date("2026-03-30"),
        note: "10 days exploring temples, incredible ramen spots, and the energy of Shibuya.",
        rating: 5,
      },
    }),
    prisma.trip.create({
      data: {
        userId,
        code: "US",
        city: "Monterey",
        country: "United States",
        lat: 36.6002,
        lon: -121.8947,
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-09"),
        note: "PCH road trip — Big Sur cliffs, Monterey aquarium, Paso Robles wine tasting.",
        rating: 4,
      },
    }),
    prisma.trip.create({
      data: {
        userId,
        code: "GR",
        city: "Santorini",
        country: "Greece",
        lat: 36.3932,
        lon: 25.4615,
        startDate: new Date("2025-06-10"),
        endDate: new Date("2025-06-20"),
        note: "Island hopping — Santorini sunsets were unreal. Mykonos nightlife was wild.",
        rating: 5,
      },
    }),
    prisma.trip.create({
      data: {
        userId,
        code: "IS",
        city: "Reykjavik",
        country: "Iceland",
        lat: 64.1466,
        lon: -21.9426,
        startDate: new Date("2025-02-01"),
        endDate: new Date("2025-02-07"),
        note: "Northern Lights were breathtaking. Golden Circle and Blue Lagoon are must-dos.",
        rating: 5,
      },
    }),
    prisma.trip.create({
      data: {
        userId,
        code: "GB",
        city: "London",
        country: "United Kingdom",
        lat: 51.5074,
        lon: -0.1278,
        startDate: new Date("2024-12-20"),
        endDate: new Date("2024-12-27"),
        note: "Christmas in London — markets, West End shows, and mulled wine everywhere.",
        rating: 4,
      },
    }),
    prisma.trip.create({
      data: {
        userId,
        code: "FR",
        city: "Paris",
        country: "France",
        lat: 48.8566,
        lon: 2.3522,
        startDate: new Date("2024-09-14"),
        endDate: new Date("2024-09-19"),
        note: "Art, pastries, and wandering the Left Bank. The Louvre needs a full day minimum.",
        rating: 4,
      },
    }),
    prisma.trip.create({
      data: {
        userId,
        code: "IT",
        city: "Rome",
        country: "Italy",
        lat: 41.9028,
        lon: 12.4964,
        startDate: new Date("2024-09-19"),
        endDate: new Date("2024-09-24"),
        note: "Combined with Paris trip. Colosseum, Vatican, and the best carbonara ever.",
        rating: 5,
      },
    }),
    prisma.trip.create({
      data: {
        userId,
        code: "MX",
        city: "Cancun",
        country: "Mexico",
        lat: 21.1619,
        lon: -86.8515,
        startDate: new Date("2025-04-05"),
        endDate: new Date("2025-04-12"),
        note: "Beach week — did a day trip to Chichen Itza and cenote swimming.",
        rating: 4,
      },
    }),
    prisma.trip.create({
      data: {
        userId,
        code: "TH",
        city: "Bangkok",
        country: "Thailand",
        lat: 13.7563,
        lon: 100.5018,
        startDate: new Date("2024-05-10"),
        endDate: new Date("2024-05-20"),
        note: "Street food paradise. Temples, tuk-tuks, and island hopping in the south.",
        rating: 5,
      },
    }),
  ]);

  console.log(`  Created ${trips.length} trips`);

  // ─── JOURNAL ENTRIES ──────────────────────────────────────────────────────
  const journals = await Promise.all([
    prisma.journalEntry.create({
      data: {
        userId,
        tripId: trips[0].id, // New York
        title: "Weekend in New York",
        content: `Flew in Friday night and hit the ground running. Times Square at midnight is exactly as chaotic as you'd expect — neon everywhere, street performers on every corner, that electric buzz you can't get anywhere else.

Saturday was Central Park in the fall — the colors were incredible. Rented bikes and rode from the south end up to the reservoir. Grabbed pastrami sandwiches at Katz's Deli (worth every penny and every minute in line).

Sunday night we saw Wicked on Broadway. I've seen it before but there's something about seeing it IN New York that hits different. The whole theater was packed and the energy was insane.

Already planning the next trip — want to do Brooklyn properly next time, and definitely need to try that pizza place in the West Village everyone keeps talking about.`,
        location: "New York, NY",
        country: "United States",
        lat: 40.7128,
        lon: -74.006,
        date: new Date("2025-11-16"),
        mood: "excited",
        weather: "clear",
        tags: JSON.stringify(["city", "food", "broadway", "fall"]),
        photos: JSON.stringify([
          "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800",
          "https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=800",
        ]),
      },
    }),
    prisma.journalEntry.create({
      data: {
        userId,
        tripId: trips[1].id, // Tokyo
        title: "Tokyo Adventure",
        content: `This trip changed my perspective on travel entirely. Tokyo is a masterclass in contrasts — ancient temples next to neon-lit skyscrapers, serene gardens steps from the busiest intersection on earth.

Senso-ji temple in Asakusa at sunrise was magical. Almost no tourists, just locals doing morning prayers with incense drifting through the gates. Then two hours later I was in Shibuya watching thousands of people cross in every direction.

The ramen. Oh my god, the ramen. Found a tiny 8-seat shop in Shinjuku — no English menu, just pointed at what the guy next to me was eating. Rich tonkotsu broth, perfect noodles, melt-in-your-mouth chashu. I went back three times.

Took the bullet train to Kyoto for two days — the bamboo grove and Fushimi Inari shrine are as stunning as the photos suggest. The train itself is an experience — 200mph and smoother than most elevators.

Akihabara was sensory overload in the best way. Bought way too many trinkets. Harajuku on a Sunday is like stepping into another dimension. Already saving for cherry blossom season next year.`,
        location: "Tokyo",
        country: "Japan",
        lat: 35.6762,
        lon: 139.6503,
        date: new Date("2026-03-25"),
        mood: "inspired",
        weather: "partly cloudy",
        tags: JSON.stringify(["temples", "food", "culture", "trains", "city"]),
        photos: JSON.stringify([
          "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800",
          "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800",
          "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800",
        ]),
      },
    }),
    prisma.journalEntry.create({
      data: {
        userId,
        tripId: trips[2].id, // PCH
        title: "Road Trip: Pacific Coast Highway",
        content: `There's something about a road trip that resets your brain. We picked up a convertible in San Francisco and drove south on Highway 1 with nothing but time.

Big Sur was the highlight — Bixby Bridge, McWay Falls, the cliffs dropping straight into the Pacific. Pulled over at every turnout. Each one felt like a postcard.

Monterey was charming — spent a full morning at the aquarium watching the jellyfish exhibit (honestly mesmerizing). Cannery Row has great seafood if you know where to look past the tourist traps.

Detoured inland to Paso Robles wine country. Did three tastings and bought a case of Zinfandel that barely fit in the trunk. The rolling golden hills with rows of vines stretching to the horizon — California at its finest.

Ended in Santa Barbara for fish tacos on the pier at sunset. Four days, 400 miles, zero stress. This is how you're supposed to travel.`,
        location: "Big Sur, CA",
        country: "United States",
        lat: 36.2704,
        lon: -121.8081,
        date: new Date("2026-01-06"),
        mood: "relaxed",
        weather: "sunny",
        tags: JSON.stringify(["road-trip", "nature", "wine", "coast", "california"]),
        photos: JSON.stringify([
          "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800",
          "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?w=800",
        ]),
      },
    }),
    prisma.journalEntry.create({
      data: {
        userId,
        tripId: trips[3].id, // Greece
        title: "Greek Islands",
        content: `Santorini sunsets live up to the hype. Sat on the caldera wall in Oia with a glass of Assyrtiko wine watching the sun melt into the Aegean. Every single evening was like that — and it never got old.

The white and blue villages clinging to the cliffs are even more photogenic in person. Got lost in the alleyways of Fira for hours, ducking into little shops and tiny churches.

Ferry to Mykonos was an adventure — turquoise water, white-sand beaches, and the most Instagram-worthy windmills you've ever seen. Little Venice at sunset with fresh grilled octopus and ouzo — perfection.

But the real magic was the local food. A family taverna in Pyrgos served us dishes we didn't order — just plate after plate of whatever grandma felt like cooking. Stuffed tomatoes, fresh feta with oregano and olive oil, grilled fish caught that morning. Best meal of the trip, maybe of my life.

Took a catamaran tour around the caldera — swimming in the hot springs, snorkeling near the volcanic islands. The water is impossibly clear.`,
        location: "Santorini",
        country: "Greece",
        lat: 36.3932,
        lon: 25.4615,
        date: new Date("2025-06-14"),
        mood: "peaceful",
        weather: "sunny",
        tags: JSON.stringify(["islands", "sunsets", "food", "beaches", "sailing"]),
        photos: JSON.stringify([
          "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800",
          "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800",
        ]),
      },
    }),
    prisma.journalEntry.create({
      data: {
        userId,
        tripId: trips[4].id, // Iceland
        title: "Iceland Northern Lights",
        content: `Chasing the Northern Lights was always on my bucket list. And Iceland delivered in a way I never expected.

First night was cloudy — nothing. Second night, our guide drove us an hour outside Reykjavik to a pitch-black lava field. And then it happened. Green curtains of light rippling across the entire sky. No photo does it justice. I just stood there with my mouth open.

The Golden Circle was spectacular — Thingvellir (where tectonic plates literally pull apart), Geysir erupting every few minutes, and Gullfoss waterfall thundering with mist in the freezing air.

Blue Lagoon was the perfect recovery — floating in milky blue geothermal water with a beer in hand while snow fell around us. Surreal.

Did a glacier hike on Solheimajokull — crampons, ice axes, walking on ancient ice with the guide pointing out blue ice caves. Felt like another planet.

Iceland is expensive but worth every krona. The landscapes are unlike anything else on Earth. Already planning a summer trip to see the midnight sun.`,
        location: "Reykjavik",
        country: "Iceland",
        lat: 64.1466,
        lon: -21.9426,
        date: new Date("2025-02-03"),
        mood: "amazed",
        weather: "cold",
        tags: JSON.stringify(["northern-lights", "nature", "adventure", "winter", "glaciers"]),
        photos: JSON.stringify([
          "https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=800",
          "https://images.unsplash.com/photo-1520769945061-0a448c463865?w=800",
        ]),
      },
    }),
    prisma.journalEntry.create({
      data: {
        userId,
        tripId: trips[5].id, // London
        title: "Christmas in London",
        content: `London during the holidays is pure magic. Every street has lights strung overhead, every pub has mulled wine and mince pies, and there's a Christmas market on practically every corner.

Winter Wonderland in Hyde Park was festive chaos — ice skating, German sausages, ridiculous rides, and enough hot chocolate to fill the Thames. Went on the big wheel at night and the whole city sparkled.

Caught a West End show (Hamilton — absolutely incredible even the third time), explored the British Museum for free (still mind-blowing), and ate our weight in fish and chips.

Walked along the South Bank from Tower Bridge to Westminster as the sun set — London Eye lit up, Big Ben chiming, boats passing on the river. One of those "pinch me" travel moments.

Borough Market was a highlight — oysters, raclette, truffle cheese, fresh doughnuts. Could spend a whole day there and still not try everything.`,
        location: "London",
        country: "United Kingdom",
        lat: 51.5074,
        lon: -0.1278,
        date: new Date("2024-12-22"),
        mood: "festive",
        weather: "cold",
        tags: JSON.stringify(["christmas", "city", "food", "theater", "winter"]),
        photos: JSON.stringify([
          "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800",
        ]),
      },
    }),
    prisma.journalEntry.create({
      data: {
        userId,
        tripId: trips[7].id, // Rome
        title: "Paris to Rome by Train",
        content: `Combined two dream cities in one trip. Started in Paris with five days of art, pastries, and wandering.

The Louvre is overwhelming in the best way — give it a full day minimum. Musee d'Orsay is actually my favorite though, the Impressionist collection is stunning. Sat at a cafe on Rue Mouffetard eating a perfect croissant and people-watching — that's the real Parisian experience.

Took a high-speed train to Rome and the contrast was immediate — louder, warmer, more chaotic, and I loved it. The Colosseum at golden hour made me emotional. Standing where gladiators fought 2,000 years ago hits differently in person.

Vatican was jaw-dropping. The Sistine Chapel ceiling is impossibly detailed — spent 30 minutes just staring up. St. Peter's Basilica is the most impressive building I've ever walked into.

But the food was the star. Found a trattoria in Trastevere — cacio e pepe that was so simple and so perfect. Carbonara at Da Enzo (worth the hour wait). Gelato from Fatamorgana twice a day, no regrets.`,
        location: "Rome",
        country: "Italy",
        lat: 41.9028,
        lon: 12.4964,
        date: new Date("2024-09-20"),
        mood: "inspired",
        weather: "warm",
        tags: JSON.stringify(["art", "history", "food", "trains", "culture"]),
        photos: JSON.stringify([
          "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800",
          "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=800",
        ]),
      },
    }),
  ]);

  console.log(`  Created ${journals.length} journal entries`);

  // ─── TRIP PLANS (upcoming) ────────────────────────────────────────────────
  const portugalPlan = await prisma.tripPlan.create({
    data: {
      userId,
      name: "Summer in Portugal",
      description:
        "Two-week Portugal trip — start in Lisbon, train to Porto, end in the Algarve for beach time. Pasteis de nata every single day.",
      startDate: new Date("2026-08-10"),
      endDate: new Date("2026-08-24"),
      budget: 4500,
      status: "PLANNED",
      legs: {
        create: [
          {
            origin: "JFK",
            destination: "LIS",
            departDate: new Date("2026-08-10"),
            returnDate: null,
            fareAmount: 485,
            fareSource: "Google Flights",
            notes: "Direct flight, TAP Air Portugal",
            sortOrder: 0,
          },
          {
            origin: "LIS",
            destination: "OPO",
            departDate: new Date("2026-08-16"),
            returnDate: null,
            fareAmount: 35,
            fareSource: "CP Rail",
            notes: "Train ride — 3 hours along the coast",
            sortOrder: 1,
          },
          {
            origin: "OPO",
            destination: "FAO",
            departDate: new Date("2026-08-20"),
            returnDate: null,
            fareAmount: 65,
            fareSource: "Ryanair",
            notes: "Quick hop south to the Algarve",
            sortOrder: 2,
          },
          {
            origin: "FAO",
            destination: "JFK",
            departDate: new Date("2026-08-24"),
            returnDate: null,
            fareAmount: 520,
            fareSource: "Google Flights",
            notes: "Return flight via Lisbon connection",
            sortOrder: 3,
          },
        ],
      },
    },
  });

  const japanPlan = await prisma.tripPlan.create({
    data: {
      userId,
      name: "Japan Cherry Blossom Season 2027",
      description:
        "Going back to Japan for sakura season. Tokyo, Kyoto, Osaka, maybe Hiroshima. Need to book 6+ months out for good rates.",
      startDate: new Date("2027-03-25"),
      endDate: new Date("2027-04-08"),
      budget: 6000,
      status: "DRAFT",
      legs: {
        create: [
          {
            origin: "JFK",
            destination: "NRT",
            departDate: new Date("2027-03-25"),
            returnDate: new Date("2027-04-08"),
            fareAmount: null,
            fareSource: null,
            notes: "Watching for deals — target under $700 RT",
            sortOrder: 0,
          },
        ],
      },
    },
  });

  console.log(`  Created 2 trip plans (Portugal: ${portugalPlan.id}, Japan: ${japanPlan.id})`);

  // ─── LOYALTY BALANCES ─────────────────────────────────────────────────────
  const loyalties = await Promise.all([
    prisma.loyaltyBalance.create({
      data: {
        userId,
        programName: "American Airlines AAdvantage",
        programCode: "AA",
        balance: 45000,
        tier: "Gold",
        expiresAt: new Date("2027-03-31"),
      },
    }),
    prisma.loyaltyBalance.create({
      data: {
        userId,
        programName: "Marriott Bonvoy",
        programCode: "MB",
        balance: 120000,
        tier: "Platinum",
        expiresAt: new Date("2027-12-31"),
      },
    }),
  ]);

  console.log(`  Created ${loyalties.length} loyalty balances`);

  // ─── CARD PROFILES ────────────────────────────────────────────────────────
  const cards = await Promise.all([
    prisma.cardProfile.create({
      data: {
        userId,
        cardName: "Chase Sapphire Reserve",
        issuer: "Chase",
        pointsBalance: 85000,
        annualFee: 550,
        category: "travel",
      },
    }),
    prisma.cardProfile.create({
      data: {
        userId,
        cardName: "Amex Gold",
        issuer: "American Express",
        pointsBalance: 62000,
        annualFee: 325,
        category: "dining",
      },
    }),
    prisma.cardProfile.create({
      data: {
        userId,
        cardName: "Capital One Venture X",
        issuer: "Capital One",
        pointsBalance: 41000,
        annualFee: 395,
        category: "travel",
      },
    }),
  ]);

  console.log(`  Created ${cards.length} card profiles`);

  // ─── PRICE WATCHES ────────────────────────────────────────────────────────
  const watches = await Promise.all([
    prisma.watch.create({
      data: {
        userId,
        origin: "JFK",
        destinationCode: "LHR",
        targetPrice: 400,
        active: true,
        lastChecked: new Date("2026-06-23"),
      },
    }),
    prisma.watch.create({
      data: {
        userId,
        origin: "LAX",
        destinationCode: "NRT",
        targetPrice: 600,
        active: true,
        lastChecked: new Date("2026-06-22"),
      },
    }),
    prisma.watch.create({
      data: {
        userId,
        origin: "MCO",
        destinationCode: "CUN",
        targetPrice: 200,
        active: true,
        lastChecked: new Date("2026-06-23"),
      },
    }),
  ]);

  console.log(`  Created ${watches.length} price watches`);

  // ─── GAMIFICATION ─────────────────────────────────────────────────────────
  await prisma.gamificationProgress.upsert({
    where: { userId },
    create: {
      userId,
      totalPoints: 2750,
      level: 8,
      badges: JSON.stringify([
        "first_trip",
        "five_countries",
        "journal_streak_7",
        "points_collector",
        "globe_trotter",
      ]),
      streakDays: 12,
      lastActivityAt: new Date("2026-06-23"),
    },
    update: {
      totalPoints: 2750,
      level: 8,
      badges: JSON.stringify([
        "first_trip",
        "five_countries",
        "journal_streak_7",
        "points_collector",
        "globe_trotter",
      ]),
      streakDays: 12,
      lastActivityAt: new Date("2026-06-23"),
    },
  });

  console.log("  Set gamification progress (Level 8, 2750 pts, 5 badges)");

  // ─── NOTIFICATION PREFS ───────────────────────────────────────────────────
  await prisma.notificationPref.upsert({
    where: { userId },
    create: {
      userId,
      emailDigest: true,
      pushEnabled: true,
      dealAlerts: true,
      priceDrops: true,
      weeklyReport: true,
    },
    update: {},
  });

  console.log("  Set notification preferences");

  // ─── UPDATE USER PREFS (make onboarding complete, set home airports) ─────
  await prisma.user.update({
    where: { id: userId },
    data: {
      onboarded: true,
      homeAirports: ["JFK", "LGA", "EWR"],
      loyaltyPrograms: ["AA", "MB"],
      heldCards: cards.map((c) => c.id),
      tripStyles: ["culture", "food", "adventure", "nature"],
      cabin: "economy",
      maxTravelHours: 18,
      flightPref: "international",
    },
  });

  console.log("  Updated user preferences (onboarded, home airports, styles)");

  console.log("\nDemo seed complete! The app should now look populated and polished.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
