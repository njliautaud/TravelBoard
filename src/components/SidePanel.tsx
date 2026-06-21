"use client";

import type { LocationItem } from "@/lib/types";
import { coverImageSrc } from "@/lib/thumb";

export type PanelSelection =
  | { type: "country"; code: string; name: string }
  | { type: "location"; id: string }
  | null;

interface SidePanelProps {
  selection: PanelSelection;
  locations: LocationItem[];
  editor: boolean;
  onClose: () => void;
  onDetails: (loc: LocationItem) => void;
  onEdit: (loc: LocationItem) => void;
  onDelete: (loc: LocationItem) => void;
}

function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("instagram")) return "Instagram";
    if (u.hostname.includes("google") && (u.pathname.includes("maps") || u.hostname.includes("maps"))) return "Google Maps";
    if (u.hostname.includes("youtube") || u.hostname.includes("youtu.be")) return "YouTube";
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function EntryCard({
  loc,
  editor,
  showDetails,
  onDetails,
  onEdit,
  onDelete,
}: {
  loc: LocationItem;
  editor: boolean;
  showDetails: boolean;
  onDetails: (l: LocationItem) => void;
  onEdit: (l: LocationItem) => void;
  onDelete: (l: LocationItem) => void;
}) {
  const images = loc.media.filter((m) => m.type === "UPLOAD" || m.type === "IMAGE_URL");
  const links = loc.media.filter((m) => m.type === "LINK");
  const coverSrc = coverImageSrc(loc.coverImageUrl, 400);
  const reminderDue = loc.reminderAt !== null && new Date(loc.reminderAt) <= new Date();

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      {coverSrc && (
        <div className="relative flex w-full items-center justify-center bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverSrc}
            alt={loc.activityName}
            className="mx-auto block h-auto max-h-80 w-auto max-w-full object-contain"
          />
          {images.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-slate-200">
              +{images.length - 1} more
            </span>
          )}
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-100 leading-tight">{loc.activityName}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              loc.status === "VISITED"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                : "bg-amber-500/15 text-amber-300 border border-amber-500/40"
            }`}
          >
            {loc.status === "VISITED" ? "Visited" : "To visit"}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {[loc.city, loc.region, loc.countryName].filter(Boolean).join(", ")}
        </p>

        {loc.isDeal && loc.latestPrice && (
          <div className="deal-pulse inline-flex items-center gap-1.5 rounded-lg border border-rose-400/50 bg-rose-500/15 px-2 py-1 text-xs font-medium text-rose-300">
            Flight deal: {loc.latestPrice.currency} {loc.latestPrice.price.toFixed(0)}
            {loc.latestPrice.origin && loc.latestPrice.destination && (
              <span className="text-rose-300/80">
                ({loc.latestPrice.origin} &rarr; {loc.latestPrice.destination})
              </span>
            )}
            {loc.priceThreshold !== null && (
              <span className="text-rose-300/60">under {loc.latestPrice.currency} {loc.priceThreshold.toFixed(0)}</span>
            )}
          </div>
        )}
        {!loc.isDeal && loc.latestPrice && (
          <p className="text-xs text-slate-500">
            Latest flight: {loc.latestPrice.currency} {loc.latestPrice.price.toFixed(0)}
            {loc.priceThreshold !== null && ` (watching for < ${loc.priceThreshold.toFixed(0)})`}
          </p>
        )}

        {loc.notes && <p className="whitespace-pre-wrap text-sm text-slate-300">{loc.notes}</p>}

        {links.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {links.map((m, i) => (
              <a
                key={m.id ?? i}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300 hover:bg-sky-500/20"
              >
                {m.caption || linkLabel(m.url)}
              </a>
            ))}
          </div>
        )}

        {loc.reminderAt && (
          <p className={`text-xs ${reminderDue ? "text-rose-300 font-medium" : "text-slate-500"}`}>
            {reminderDue ? "Reminder due: " : "Reminder: "}
            {formatDate(loc.reminderAt)}
          </p>
        )}

        {(showDetails || editor) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {showDetails && (
            <button
              onClick={() => onDetails(loc)}
              className="rounded-lg border border-sky-600/50 px-2.5 py-1 text-xs text-sky-300 hover:bg-sky-600/20"
            >
              Details
            </button>
          )}
          {editor && (
            <>
              <button
                onClick={() => onEdit(loc)}
                className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700/60"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(loc)}
                className="rounded-lg border border-rose-600/50 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-600/20"
              >
                Delete
              </button>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

export default function SidePanel({ selection, locations, editor, onClose, onDetails, onEdit, onDelete }: SidePanelProps) {
  const open = selection !== null;

  let title = "";
  let subtitle = "";
  let entries: LocationItem[] = [];
  if (selection?.type === "country") {
    entries = locations.filter((l) => l.countryCode === selection.code);
    title = selection.name;
    subtitle = `${entries.length} ${entries.length === 1 ? "wish" : "wishes"} logged`;
  } else if (selection?.type === "location") {
    entries = locations.filter((l) => l.id === selection.id);
    title = entries[0]?.activityName ?? "";
    subtitle = entries[0] ? [entries[0].city, entries[0].countryName].filter(Boolean).join(", ") : "";
  }

  return (
    <aside
      className={`fixed z-30 bg-slate-950/90 backdrop-blur-md border-slate-700/60 transition-transform duration-300 ease-out
        inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl border-t
        sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:max-h-none sm:w-[400px] sm:rounded-none sm:border-l sm:border-t-0
        ${open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"}`}
      aria-hidden={!open}
    >
      <div className="flex h-full max-h-[70vh] flex-col sm:max-h-none">
        <div className="flex items-start justify-between border-b border-slate-700/60 p-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">{title}</h2>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="panel-scroll flex-1 space-y-3 overflow-y-auto p-4">
          {entries.length === 0 && <p className="text-sm text-slate-500">Nothing logged here yet.</p>}
          {entries.map((loc) => (
            <EntryCard
              key={loc.id}
              loc={loc}
              editor={editor}
              showDetails
              onDetails={onDetails}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
