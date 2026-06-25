"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function JournalIndexPage() {
  const [entries, setEntries] = useState<PublicEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const base = getApiBase();
    fetch(`${base}/api/journal/public`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        setEntries(data.entries ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-amber-400">Travel Journal</h1>
          <Link
            href="/"
            className="px-4 py-2 bg-amber-500 text-slate-950 font-semibold rounded-lg hover:bg-amber-400 transition text-sm"
          >
            Open TravelBoard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {loading && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">Loading entries...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">
              Unable to load journal entries right now. Please try again later.
            </p>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">{"\u{1F4D6}"}</p>
            <h2 className="text-xl font-semibold text-slate-300 mb-2">
              No public entries yet
            </h2>
            <p className="text-slate-500">
              Public journal entries from travelers will appear here.
            </p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/journal/${entry.id}`}
                className="group block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/5"
              >
                {/* Photo thumbnail */}
                {entry.photos.length > 0 && (
                  <div className="aspect-video bg-slate-800 overflow-hidden">
                    <img
                      src={entry.photos[0]}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                <div className="p-4">
                  {/* Mood & Weather badges */}
                  <div className="flex items-center gap-2 mb-2">
                    {entry.mood && (
                      <span className="text-lg" title={entry.mood}>
                        {MOODS[entry.mood] ?? entry.mood}
                      </span>
                    )}
                    {entry.weather && (
                      <span className="text-lg" title={entry.weather}>
                        {WEATHER[entry.weather] ?? entry.weather}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors line-clamp-2 mb-1">
                    {entry.title}
                  </h2>

                  {/* Location */}
                  {(entry.location || entry.trip) && (
                    <p className="text-sm text-slate-400 mb-2">
                      {entry.location ??
                        (entry.trip
                          ? `${entry.trip.city}, ${entry.trip.country}`
                          : "")}
                    </p>
                  )}

                  {/* Content preview */}
                  <p className="text-sm text-slate-500 line-clamp-3 mb-3">
                    {entry.content}
                  </p>

                  {/* Tags */}
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {entry.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        >
                          {tag}
                        </span>
                      ))}
                      {entry.tags.length > 4 && (
                        <span className="text-xs text-slate-500">
                          +{entry.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer: date & author */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
                    <span>
                      {entry.date
                        ? new Date(entry.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : new Date(entry.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                    </span>
                    {entry.author.username && (
                      <span className="text-slate-400">
                        by {entry.author.username}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
