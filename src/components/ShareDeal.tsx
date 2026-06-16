"use client";

/**
 * Phase 3 — Share Deal button + shared deal landing view.
 * Uses Web Share API on mobile, clipboard fallback on desktop.
 * No server-side encoding needed -- deal info is base64-encoded in the URL.
 */

import { useCallback, useState } from "react";

interface ShareableDeal {
  origin: string;
  dest: string;
  price: number;
  cityTo?: string;
  countryTo?: string;
  departDate?: string;
  returnDate?: string;
  deepLink?: string;
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function encodeDeal(deal: ShareableDeal): string {
  try {
    return btoa(JSON.stringify(deal));
  } catch {
    return "";
  }
}

export function decodeDeal(code: string): ShareableDeal | null {
  try {
    return JSON.parse(atob(code));
  } catch {
    return null;
  }
}

export function ShareButton({
  deal,
  className = "",
}: {
  deal: ShareableDeal;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleShare = useCallback(async () => {
    try {
      const code = encodeDeal(deal);
      const fullUrl = `${window.location.origin}?share=${code}`;
      const title = `Flight deal: ${deal.origin} to ${deal.cityTo ?? deal.dest}`;
      const text = `${deal.cityTo ?? deal.dest} for $${deal.price}${deal.departDate ? ` (${fmtDate(deal.departDate)})` : ""}`;

      if (navigator.share) {
        await navigator.share({ title, text, url: fullUrl });
        setStatus("copied");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(fullUrl);
        setStatus("copied");
      } else {
        window.prompt("Copy this link:", fullUrl);
        setStatus("copied");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2500);
  }, [deal]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void handleShare();
      }}
      title="Share this deal"
      aria-label="Share this deal"
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
        status === "copied"
          ? "bg-emerald-500/20 text-emerald-400"
          : status === "error"
          ? "bg-red-500/20 text-red-400"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      } ${className}`}
    >
      {status === "idle" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )}
      {status === "copied" && "Copied!"}
      {status === "error" && "Failed"}
    </button>
  );
}

/**
 * Full shared-deal landing view when someone opens a shared link.
 */
export function SharedDealView({ shareCode }: { shareCode: string }) {
  const deal = decodeDeal(shareCode);

  if (!deal) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center backdrop-blur-lg">
          <p className="text-sm text-red-400">
            This shared link may have expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-lg">
        <span className="inline-block rounded-full bg-amber-500/20 px-3 py-0.5 text-xs font-semibold text-amber-400">
          Shared deal
        </span>

        <div className="mt-4 flex items-center gap-3 text-xl font-bold text-slate-100">
          <span>{deal.origin}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span>{deal.cityTo ?? deal.dest}</span>
          <span className="text-sm font-normal text-slate-500">{deal.dest}</span>
        </div>

        {deal.countryTo && (
          <p className="mt-1 text-sm text-slate-400">{deal.countryTo}</p>
        )}

        <p className="mt-4 text-3xl font-black text-amber-400">
          ${deal.price.toLocaleString()}
        </p>

        {(deal.departDate || deal.returnDate) && (
          <p className="mt-2 text-sm text-slate-400">
            {deal.departDate && fmtDate(deal.departDate)}
            {deal.departDate && deal.returnDate && " \u2192 "}
            {deal.returnDate && fmtDate(deal.returnDate)}
          </p>
        )}

        {deal.deepLink && (
          <a
            href={deal.deepLink}
            className="mt-5 block rounded-xl bg-amber-500 px-4 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-amber-400"
            target="_blank"
            rel="noreferrer"
          >
            Book this fare &rarr;
          </a>
        )}

        <p className="mt-4 text-center text-xs text-slate-600">
          Shared via TravelBoard. Prices may have changed since this was shared.
        </p>
      </div>
    </div>
  );
}
