"use client";

import Link from "next/link";

interface SharedEntry {
  id: string;
  title: string;
  content: string;
  location: string | null;
  country: string | null;
  date: string | null;
  mood: string | null;
  moodEmoji: string | null;
  weather: string | null;
  weatherEmoji: string | null;
  tags: string[];
  photos: string[];
  trip: { city: string; country: string } | null;
  author: { username: string; imageUrl: string | null };
  createdAt: string;
}

export default function SharedJournalEntry({ entry }: { entry: SharedEntry }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="border-b border-slate-800/60 bg-slate-950/90 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="text-sm font-bold text-amber-400 hover:text-amber-300">
            TravelBoard
          </Link>
          <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-400">
            Shared journal entry
          </span>
        </div>
      </header>

      {/* Entry */}
      <main className="mx-auto max-w-2xl px-6 py-8">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
          {/* Author */}
          <div className="mb-5 flex items-center gap-3">
            {entry.author.imageUrl ? (
              <img
                src={entry.author.imageUrl}
                alt={entry.author.username}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-amber-500/30"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-400">
                {entry.author.username[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <span className="text-sm font-medium text-slate-200">
                {entry.author.username}
              </span>
              {entry.date && (
                <span className="ml-2 text-xs text-slate-500">
                  {new Date(entry.date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="mb-2 text-2xl font-bold text-slate-50">{entry.title}</h1>

          {/* Location meta */}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {entry.location && (
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {entry.location}
              </span>
            )}
            {entry.country && <span>· {entry.country}</span>}
            {entry.trip && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5">
                Trip: {entry.trip.city}, {entry.trip.country}
              </span>
            )}
          </div>

          {/* Mood + Weather */}
          {(entry.mood || entry.weather) && (
            <div className="mb-5 flex gap-2">
              {entry.mood && (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                  {entry.moodEmoji} {entry.mood}
                </span>
              )}
              {entry.weather && (
                <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs text-sky-300">
                  {entry.weatherEmoji} {entry.weather}
                </span>
              )}
            </div>
          )}

          {/* Photos */}
          {entry.photos.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-2 overflow-hidden rounded-xl">
              {entry.photos.map((photo, i) => (
                <div
                  key={i}
                  className={`overflow-hidden ${entry.photos.length === 1 ? "col-span-2" : ""}`}
                >
                  <img
                    src={photo}
                    alt={`${entry.title} photo ${i + 1}`}
                    className="h-48 w-full object-cover transition hover:scale-105"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {entry.content}
          </div>

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* CTA */}
        <div className="mt-6 text-center">
          <p className="mb-3 text-sm text-slate-500">
            Start your own travel journal
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
          >
            Open TravelBoard
          </Link>
        </div>
      </main>
    </div>
  );
}
