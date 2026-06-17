"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * /share — Share target page for PWA.
 *
 * When the app is installed as a PWA, sharing a URL from another app
 * (Instagram, TikTok, Safari, etc.) will open this page with the
 * shared URL as a query parameter.
 *
 * It automatically imports the URL as a journal entry and shows
 * the result (detected destinations, vibes, etc.).
 */

interface ImportResult {
  entry: {
    id: string;
    title: string;
    content: string;
    tags: string[];
    photos: string[];
    location: string | null;
  };
  destinations: string[];
  vibes: string[];
  metadata: {
    title: string | null;
    description: string | null;
    image: string | null;
    source: string;
  };
}

const VIBE_EMOJI: Record<string, string> = {
  beach: "🏖️",
  adventure: "🏔️",
  city: "🏙️",
  culture: "🏛️",
  food: "🍜",
  nightlife: "🎶",
  nature: "🌿",
  luxury: "✨",
  romantic: "💕",
};

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-amber-400" />
      </div>
    }>
      <SharePageInner />
    </Suspense>
  );
}

function SharePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [url, setUrl] = useState(searchParams.get("url") ?? searchParams.get("text") ?? "");
  const [notes, setNotes] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-import if URL was provided via share target
  const sharedUrl = searchParams.get("url") ?? searchParams.get("text");
  useEffect(() => {
    if (sharedUrl && !result && !importing) {
      handleImport(sharedUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImport(importUrl?: string) {
    const targetUrl = importUrl ?? url;
    if (!targetUrl.trim()) {
      setError("Please enter a URL to import");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/journal/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, notes }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Import failed" }));
        setError(data.error ?? `Import failed (${res.status})`);
        return;
      }

      const data: ImportResult = await res.json();
      setResult(data);
    } catch {
      setError("Network error - please try again");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-amber-400">
            TravelBoard
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Save travel inspiration to your journal
          </p>
        </div>

        {result ? (
          /* Success view */
          <div className="space-y-4 animate-fade-up">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <div className="text-lg font-semibold text-emerald-400">Saved!</div>
              <p className="mt-1 text-sm text-slate-300">{result.entry.title}</p>
            </div>

            {/* Cover image */}
            {result.metadata.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.metadata.image}
                alt=""
                className="w-full rounded-xl object-cover max-h-48"
              />
            )}

            {/* Detected destinations */}
            {result.destinations.length > 0 && (
              <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Destinations detected
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.destinations.map((d) => (
                    <span
                      key={d}
                      className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-300"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detected vibes */}
            {result.vibes.length > 0 && (
              <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Travel vibes
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.vibes.map((v) => (
                    <span
                      key={v}
                      className="rounded-full bg-teal-500/15 border border-teal-500/30 px-2.5 py-1 text-xs font-medium text-teal-300"
                    >
                      {VIBE_EMOJI[v] ?? ""} {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push("/")}
                className="flex-1 rounded-xl bg-amber-500 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                Open TravelBoard
              </button>
              <button
                onClick={() => {
                  setResult(null);
                  setUrl("");
                  setNotes("");
                }}
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
              >
                Import another
              </button>
            </div>
          </div>
        ) : (
          /* Input form */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                URL to import
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste an Instagram, TikTok, or travel URL..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why does this inspire you?"
                rows={3}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 outline-none resize-none"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={() => handleImport()}
              disabled={importing || !url.trim()}
              className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  Importing...
                </span>
              ) : (
                "Import to Journal"
              )}
            </button>

            <p className="text-center text-[11px] text-slate-500">
              Supports Instagram, TikTok, YouTube, Twitter, and any travel URL.
              We&apos;ll extract destinations, vibes, and images automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
