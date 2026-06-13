"use client";

import type { DraftItem } from "@/lib/types";

interface DraftInboxProps {
  open: boolean;
  drafts: DraftItem[];
  onClose: () => void;
  onOpenDraft: (draft: DraftItem) => void;
  onDeleteDraft: (draft: DraftItem) => void;
}

export default function DraftInbox({ open, drafts, onClose, onOpenDraft, onDeleteDraft }: DraftInboxProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-scroll max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700/70 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Draft inbox</h2>
            <p className="text-xs text-slate-500">Unsorted links from WhatsApp &mdash; click to turn into a wish</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {drafts.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            No drafts yet. Share an Instagram reel to your WhatsApp bot to see it here.
          </p>
        )}
        <ul className="space-y-2">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3"
            >
              <p className="line-clamp-2 text-sm text-slate-300">{d.rawText ?? d.extractedUrl}</p>
              {d.extractedUrl && (
                <a
                  href={d.extractedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block truncate text-xs text-sky-400 hover:underline"
                >
                  {d.extractedUrl}
                </a>
              )}
              <p className="mt-1 text-[10px] text-slate-600">
                {new Date(d.createdAt).toLocaleString()} &middot; {d.source}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onOpenDraft(d)}
                  className="rounded-lg bg-amber-500/90 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                >
                  Add to map
                </button>
                <button
                  onClick={() => onDeleteDraft(d)}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-400 hover:text-rose-300"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
