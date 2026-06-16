"use client";

/**
 * Phase 3 — Favorites / Saved Deals Panel.
 * localStorage-first with server sync. Shows saved deals with current-vs-saved
 * price comparison and quick actions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShareButton } from "./ShareDeal";

// ---------------------------------------------------------------------------
// localStorage layer
// ---------------------------------------------------------------------------

const FAVORITES_KEY = "travelboard_favorites";

export interface SavedFavorite {
  flyTo: string;
  cityTo: string;
  countryTo: string;
  savedPrice: number;
  savedAt: string;
  origin: string;
  deepLink: string;
  lat?: number;
  lon?: number;
}

function loadLocalFavorites(): SavedFavorite[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) ?? [];
  } catch {
    return [];
  }
}

function saveLocalFavorites(favs: SavedFavorite[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch {}
}

// ---------------------------------------------------------------------------
// Hook: useFavorites
// ---------------------------------------------------------------------------

export function useFavorites(origin: string) {
  const [localFavs, setLocalFavs] = useState<SavedFavorite[]>(() => loadLocalFavorites());

  const originFavs = useMemo(
    () => localFavs.filter((f) => f.origin === origin),
    [localFavs, origin],
  );

  const isFavorite = useCallback(
    (code: string) => localFavs.some((f) => f.flyTo === code && f.origin === origin),
    [localFavs, origin],
  );

  const toggleFavorite = useCallback(
    (deal: { flyTo: string; cityTo: string; countryTo: string; price: number; deepLink: string; lat?: number; lon?: number }) => {
      const exists = localFavs.findIndex((f) => f.flyTo === deal.flyTo && f.origin === origin);
      let next: SavedFavorite[];

      if (exists >= 0) {
        next = [...localFavs];
        next.splice(exists, 1);
      } else {
        const fav: SavedFavorite = {
          flyTo: deal.flyTo,
          cityTo: deal.cityTo,
          countryTo: deal.countryTo,
          savedPrice: deal.price,
          savedAt: new Date().toISOString(),
          origin,
          deepLink: deal.deepLink,
          lat: deal.lat,
          lon: deal.lon,
        };
        next = [fav, ...localFavs];
      }

      setLocalFavs(next);
      saveLocalFavorites(next);

      // Fire-and-forget server sync
      const body = { flyTo: deal.flyTo, origin, action: exists >= 0 ? "remove" : "add" };
      fetch("/api/saved-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    },
    [localFavs, origin],
  );

  return { favorites: originFavs, isFavorite, toggleFavorite, count: originFavs.length };
}

// ---------------------------------------------------------------------------
// FavoritesPanel
// ---------------------------------------------------------------------------

export default function FavoritesPanel({
  origin,
  currentFares = [],
  onClose,
  onDealClick,
}: {
  origin: string;
  currentFares?: Array<{ flyTo: string; cityTo: string; countryTo: string; price: number; deepLink: string }>;
  onClose: () => void;
  onDealClick?: (code: string) => void;
}) {
  const { favorites, toggleFavorite } = useFavorites(origin);
  const [sortBy, setSortBy] = useState<"recent" | "price" | "change">("recent");

  const enriched = useMemo(() => {
    return favorites.map((fav) => {
      const current = currentFares.find((f) => f.flyTo === fav.flyTo);
      const currentPrice = current?.price ?? null;
      const priceChange = currentPrice != null ? currentPrice - fav.savedPrice : null;
      const pctChange =
        priceChange != null && fav.savedPrice > 0
          ? Math.round((priceChange / fav.savedPrice) * 100)
          : null;
      return { ...fav, currentPrice, priceChange, pctChange, currentDeepLink: current?.deepLink ?? fav.deepLink };
    });
  }, [favorites, currentFares]);

  const sorted = useMemo(() => {
    const arr = [...enriched];
    switch (sortBy) {
      case "price":
        return arr.sort((a, b) => (a.currentPrice ?? a.savedPrice) - (b.currentPrice ?? b.savedPrice));
      case "change":
        return arr.sort((a, b) => (a.priceChange ?? 0) - (b.priceChange ?? 0));
      default:
        return arr;
    }
  }, [enriched, sortBy]);

  const priceDrops = enriched.filter((f) => f.priceChange != null && f.priceChange < 0).length;

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Saved favorites"
    >
      <div
        className="mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">
            Saved Deals ({favorites.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Price drops banner */}
        {priceDrops > 0 && (
          <div className="mb-3 rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            {priceDrops} saved deal{priceDrops > 1 ? "s" : ""} dropped in price since you saved
          </div>
        )}

        {/* Sort controls */}
        {favorites.length > 1 && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort:</span>
            {(["recent", "price", "change"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSortBy(s)}
                className={`rounded-md px-2 py-0.5 text-xs transition ${
                  sortBy === s
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {s === "recent" ? "Recent" : s === "price" ? "Price" : "Change"}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {sorted.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-slate-300">No saved deals yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Tap the heart on any deal card to save it here. You&apos;ll see price changes at a glance.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((fav) => (
              <div
                key={fav.flyTo}
                className="group rounded-xl border border-slate-800 bg-slate-950/60 p-3 transition hover:border-amber-500/20"
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => { onDealClick?.(fav.flyTo); onClose(); }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-slate-200">
                        {fav.cityTo}
                      </span>
                      <span className="ml-1.5 text-xs text-slate-500">{fav.flyTo}</span>
                    </div>
                    <div>
                      {fav.currentPrice != null ? (
                        <span className="text-sm font-bold text-slate-100">
                          ${fav.currentPrice.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">Price unavailable</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Saved {new Date(fav.savedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      {" at "}${fav.savedPrice.toLocaleString()}
                    </span>
                    {fav.priceChange != null && (
                      <span
                        className={`font-medium ${
                          fav.priceChange < 0
                            ? "text-emerald-400"
                            : fav.priceChange > 0
                            ? "text-red-400"
                            : "text-slate-400"
                        }`}
                      >
                        {fav.priceChange < 0 ? "\u2193" : fav.priceChange > 0 ? "\u2191" : "="}
                        ${Math.abs(fav.priceChange).toLocaleString()}
                        {fav.pctChange != null && ` (${fav.pctChange > 0 ? "+" : ""}${fav.pctChange}%)`}
                      </span>
                    )}
                  </div>
                </button>

                <div className="mt-2 flex items-center gap-2 border-t border-slate-800/60 pt-2">
                  <a
                    href={fav.currentDeepLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
                  >
                    Book
                  </a>
                  <ShareButton
                    deal={{
                      origin: fav.origin,
                      dest: fav.flyTo,
                      price: fav.currentPrice ?? fav.savedPrice,
                      cityTo: fav.cityTo,
                      countryTo: fav.countryTo,
                    }}
                  />
                  <button
                    type="button"
                    className="ml-auto rounded-lg p-1 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite({
                        flyTo: fav.flyTo,
                        cityTo: fav.cityTo,
                        countryTo: fav.countryTo,
                        price: fav.currentPrice ?? fav.savedPrice,
                        deepLink: fav.currentDeepLink,
                      });
                    }}
                    title="Remove from saved"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-slate-600">
          Saved deals are stored locally and synced when signed in. Prices update
          automatically when you visit.
        </p>
      </div>
    </div>
  );
}
