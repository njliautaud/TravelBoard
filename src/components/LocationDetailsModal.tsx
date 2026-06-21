"use client";

import type { ReactNode } from "react";
import type { LocationItem } from "@/lib/types";
import { coverImageSrc } from "@/lib/thumb";

interface LocationDetailsModalProps {
  open: boolean;
  location: LocationItem | null;
  editor: boolean;
  onClose: () => void;
  onEdit: (loc: LocationItem) => void;
}

function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("instagram")) return "Instagram";
    if (u.hostname.includes("google") && (u.pathname.includes("maps") || u.hostname.includes("maps")))
      return "Google Maps";
    if (u.hostname.includes("youtube") || u.hostname.includes("youtu.be")) return "YouTube";
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-200">{children}</dd>
    </div>
  );
}

export default function LocationDetailsModal({
  open,
  location,
  editor,
  onClose,
  onEdit,
}: LocationDetailsModalProps) {
  if (!open || !location) return null;

  const loc = location;
  const coverSrc = coverImageSrc(loc.coverImageUrl, 480);
  const images = loc.media.filter((m) => m.type === "UPLOAD" || m.type === "IMAGE_URL");
  const links = loc.media.filter((m) => m.type === "LINK");
  const seasons = [
    loc.seasonSpring && "Spring",
    loc.seasonSummer && "Summer",
    loc.seasonFall && "Fall",
    loc.seasonWinter && "Winter",
  ].filter(Boolean) as string[];
  const locationLine = [loc.city, loc.region, loc.countryName].filter(Boolean).join(", ");
  const reminderDue = loc.reminderAt !== null && new Date(loc.reminderAt) <= new Date();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-scroll max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700/70 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">{loc.activityName}</h2>
            {locationLine && <p className="text-xs text-slate-400">{locationLine}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {coverSrc && (
          <div className="mb-4 flex h-44 items-center justify-center overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverSrc} alt="" className="max-h-44 max-w-full object-contain" />
          </div>
        )}

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DetailRow label="Status">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                loc.status === "VISITED"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/40"
              }`}
            >
              {loc.status === "VISITED" ? "Visited" : "To visit"}
            </span>
          </DetailRow>

          {loc.countryName && (
            <DetailRow label="Country">
              {loc.countryName}
              {loc.countryCode ? ` (${loc.countryCode})` : ""}
            </DetailRow>
          )}

          {loc.region && <DetailRow label="State / region">{loc.region}</DetailRow>}
          {loc.city && <DetailRow label="City">{loc.city}</DetailRow>}

          {seasons.length > 0 && <DetailRow label="Season">{seasons.join(", ")}</DetailRow>}

          {loc.reminderAt && (
            <DetailRow label="Reminder">
              <span className={reminderDue ? "text-rose-300 font-medium" : undefined}>
                {reminderDue ? "Due — " : ""}
                {formatDate(loc.reminderAt)}
              </span>
            </DetailRow>
          )}

          {loc.priceThreshold !== null && (
            <DetailRow label="Flight deal threshold">USD {loc.priceThreshold.toFixed(0)}</DetailRow>
          )}

          {(loc.isDeal || loc.latestPrice) && (
            <DetailRow label="Latest flight">
              {loc.latestPrice ? (
                <>
                  {loc.latestPrice.currency} {loc.latestPrice.price.toFixed(0)}
                  {loc.latestPrice.origin && loc.latestPrice.destination && (
                    <span className="text-slate-400">
                      {" "}
                      ({loc.latestPrice.origin} → {loc.latestPrice.destination})
                    </span>
                  )}
                  {loc.isDeal && (
                    <span className="ml-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-xs text-rose-300">
                      Deal
                    </span>
                  )}
                </>
              ) : (
                "—"
              )}
            </DetailRow>
          )}

          <div className="sm:col-span-2">
            <DetailRow label="Coordinates">
              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
            </DetailRow>
          </div>

          {loc.notes && (
            <div className="sm:col-span-2">
              <DetailRow label="Notes / journal">
                <p className="whitespace-pre-wrap text-slate-300">{loc.notes}</p>
              </DetailRow>
            </div>
          )}
        </dl>

        {links.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Links</p>
            <div className="flex flex-wrap gap-2">
              {links.map((m, i) => (
                <a
                  key={m.id ?? i}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-300 hover:bg-sky-500/20"
                >
                  {m.caption || linkLabel(m.url)}
                </a>
              ))}
            </div>
          </div>
        )}

        {images.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Photos</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {images.map((m, i) => (
                <div
                  key={m.id ?? i}
                  className="flex h-28 items-center justify-center overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImageSrc(m.url, 240)}
                    alt={m.caption ?? ""}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
          {editor && (
            <button
              type="button"
              onClick={() => onEdit(loc)}
              className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
