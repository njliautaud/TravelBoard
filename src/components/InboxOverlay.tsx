"use client";

import type { DraftItem, NotificationItem } from "@/lib/types";

interface InboxOverlayProps {
  open: boolean;
  notifications: NotificationItem[];
  drafts: DraftItem[];
  onClose: () => void;
  onAcceptRequest: (friendshipId: string) => void;
  onDeclineRequest: (friendshipId: string) => void;
  onOpenDraft: (draft: DraftItem) => void;
  onDeleteDraft: (draft: DraftItem) => void;
}

/**
 * Centralized inbox tray. Renders different layouts per item type:
 *  - FRIEND_REQUEST  → who asked + Accept / Decline (while unresolved)
 *  - FRIEND_ACCEPTED → "X accepted your request"
 *  - Draft           → a shared-link "pin" card → Add to map / Delete
 */
export default function InboxOverlay({
  open,
  notifications,
  drafts,
  onClose,
  onAcceptRequest,
  onDeclineRequest,
  onOpenDraft,
  onDeleteDraft,
}: InboxOverlayProps) {
  if (!open) return null;

  const isEmpty = notifications.length === 0 && drafts.length === 0;

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
            <h2 className="text-lg font-bold text-slate-100">Inbox</h2>
            <p className="text-xs text-slate-500">Friend requests &amp; shared links</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isEmpty && (
          <p className="py-8 text-center text-sm text-slate-500">
            Nothing here yet. Friend requests and links you share from WhatsApp show up here.
          </p>
        )}

        {/* Notifications: friend requests + acceptances */}
        {notifications.length > 0 && (
          <ul className="mb-3 space-y-2">
            {notifications.map((n) => {
              const who = n.actor?.username ?? "Someone";
              if (n.type === "FRIEND_REQUEST") {
                return (
                  <li
                    key={n.id}
                    className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-3"
                  >
                    <p className="text-sm text-slate-200">
                      <b className="font-semibold text-violet-200">{who}</b> wants to be friends
                    </p>
                    {n.friendshipId && !n.read ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => onAcceptRequest(n.friendshipId!)}
                          className="rounded-lg bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => onDeclineRequest(n.friendshipId!)}
                          className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-400 hover:text-rose-300"
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">Handled</p>
                    )}
                  </li>
                );
              }
              return (
                <li
                  key={n.id}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3"
                >
                  <p className="text-sm text-slate-200">
                    <b className="font-semibold text-emerald-200">{who}</b> accepted your friend request 🎉
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {/* Drafts: shared-link pin cards */}
        {drafts.length > 0 && (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
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
        )}
      </div>
    </div>
  );
}
