import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SharedJournalEntry from "./SharedJournalEntry";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const MOODS: Record<string, string> = {
  excited: "\u{1F929}",
  happy: "\u{1F60A}",
  relaxed: "\u{1F60C}",
  adventurous: "\u{1F3D4}\uFE0F",
  tired: "\u{1F634}",
  nostalgic: "\u{1F972}",
  inspired: "\u2728",
};

const WEATHER: Record<string, string> = {
  sunny: "\u2600\uFE0F",
  cloudy: "\u2601\uFE0F",
  rainy: "\u{1F327}\uFE0F",
  snowy: "\u2744\uFE0F",
  stormy: "\u26C8\uFE0F",
  windy: "\u{1F32C}\uFE0F",
};

function safeJson(val: string | null): string[] {
  if (!val) return [];
  try { const a = JSON.parse(val); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { user: { select: { username: true } } },
  });
  if (!entry || !entry.isPublic) return { title: "Journal Entry" };

  const desc = entry.content.slice(0, 160) + (entry.content.length > 160 ? "..." : "");
  return {
    title: `${entry.title} - TravelBoard Journal`,
    description: desc,
    openGraph: {
      title: entry.title,
      description: desc,
      type: "article",
      authors: [entry.user.username],
    },
  };
}

export default async function SharedJournalPage({ params }: Props) {
  const { id } = await params;

  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      trip: { select: { city: true, country: true } },
      user: { select: { username: true, imageUrl: true } },
    },
  });

  if (!entry || !entry.isPublic) {
    notFound();
  }

  const data = {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    location: entry.location,
    country: entry.country,
    date: entry.date?.toISOString() ?? null,
    mood: entry.mood,
    moodEmoji: entry.mood ? (MOODS[entry.mood] ?? "") : null,
    weather: entry.weather,
    weatherEmoji: entry.weather ? (WEATHER[entry.weather] ?? "") : null,
    tags: safeJson(entry.tags),
    photos: safeJson(entry.photos),
    trip: entry.trip ? { city: entry.trip.city, country: entry.trip.country } : null,
    author: { username: entry.user.username, imageUrl: entry.user.imageUrl },
    createdAt: entry.createdAt.toISOString(),
  };

  return <SharedJournalEntry entry={data} />;
}
