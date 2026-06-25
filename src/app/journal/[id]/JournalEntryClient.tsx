"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

interface PublicEntry {
  id: string;
  title: string;
  content: string;
  location: string | null;
  country: string | null;
  date: string | null;
  mood: string | null;
  weather: string | null;
  tags: string[];
  photos: string[];
  trip: { city: string; country: string } | null;
  author: { username: string | null; imageUrl: string | null };
  createdAt: string;
}

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

export default function JournalEntryClient() {
  const params = useParams();
  const id = params?.id as string;

  const [entry, setEntry] = useState<PublicEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "private" | "notfound" | "error">("loading");

  useEffect(() => {
    if (!id) return;
    const base = getApiBase();
    fetch(`${base}/api/journal/${id}/public`)
      .then((res) => {
        if (res.status === 404) { setStatus("notfound"); return null; }
        if (res.status === 403) { setStatus("private"); return null; }
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        if (data?.entry) {
          setEntry(data.entry);
          setStatus("ok");
        }
      })
      .catch(() => setStatus("error"));
  }, [id]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (status === "private") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-8">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4">{"\u{1F512}"}</p>
          <h1 className="text-2xl font-bold text-amber-400 mb-3">Private Entry</h1>
          <p className="text-slate-400 mb-6">This journal entry is private and cannot be viewed publicly.</p>
          <Link href="/journal" className="inline-block px-6 py-3 bg-amber-500 text-slate-950 font-semibold rounded-lg hover:bg-amber-400 transition">
            Browse Public Entries
          </Link>
        </div>
      </div>
    );
  }

  if (status === "notfound" || status === "error" || !entry) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-amber-400 mb-3">Entry Not Found</h1>
          <p className="text-slate-400 mb-6">This journal entry could not be loaded.</p>
          <Link href="/journal" className="inline-block px-6 py-3 bg-amber-500 text-slate-950 font-semibold rounded-lg hover:bg-amber-400 transition">
            Browse Public Entries
          </Link>
        </div>
      </div>
    );
  }

  const displayDate = entry.date
    ? new Date(entry.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : new Date(entry.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const locationText = entry.location ?? (entry.trip ? `${entry.trip.city}, ${entry.trip.country}` : null);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/journal" className="text-slate-400 hover:text-amber-400 transition text-sm font-medium">
            &larr; All Entries
          </Link>
          <Link href="/" className="px-4 py-2 bg-amber-500 text-slate-950 font-semibold rounded-lg hover:bg-amber-400 transition text-sm">
            Open TravelBoard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <article>
          {entry.photos.length > 0 && (
            <div className="rounded-xl overflow-hidden mb-8 border border-slate-800">
              <img src={entry.photos[0]} alt={entry.title} className="w-full max-h-[480px] object-cover" />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
            {entry.mood && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 border border-slate-700">
                <span className="text-base">{MOODS[entry.mood] ?? entry.mood}</span>
                <span className="text-slate-300 capitalize">{entry.mood}</span>
              </span>
            )}
            {entry.weather && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 border border-slate-700">
                <span className="text-base">{WEATHER[entry.weather] ?? entry.weather}</span>
                <span className="text-slate-300 capitalize">{entry.weather}</span>
              </span>
            )}
            <span className="text-slate-500">{displayDate}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{entry.title}</h1>

          {locationText && <p className="text-amber-400/80 text-lg mb-6">{locationText}</p>}

          {entry.author.username && (
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-800">
              {entry.author.imageUrl ? (
                <img src={entry.author.imageUrl} alt={entry.author.username} className="w-10 h-10 rounded-full border-2 border-amber-500/30" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  {entry.author.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-slate-300 font-medium">{entry.author.username}</span>
            </div>
          )}

          <div className="prose prose-invert prose-amber max-w-none mb-8">
            {entry.content.split("\n").map((paragraph, i) =>
              paragraph.trim() ? (
                <p key={i} className="text-slate-300 leading-relaxed mb-4">{paragraph}</p>
              ) : (
                <br key={i} />
              )
            )}
          </div>

          {entry.photos.length > 1 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-300 mb-4">Photos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {entry.photos.slice(1).map((photo, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-800">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-800">
              {entry.tags.map((tag) => (
                <span key={tag} className="text-sm px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
