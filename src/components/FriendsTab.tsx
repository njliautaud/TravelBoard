"use client";

import { useCallback, useEffect, useState } from "react";
import type { FriendsData, FriendUser } from "@/lib/types";
import ProfilePreviewCard from "./ProfilePreviewCard";

interface FriendsTabProps {
  /** Bumped by the parent (e.g. after an inbox accept) to force a refetch. */
  refreshKey?: number;
  /** Notify the parent so it can refresh the inbox badge / profile switcher. */
  onChanged?: () => void;
  /** View a friend's board read-only (from the preview card's "View map"). */
  onSelectProfile?: (friend: FriendUser) => void;
}

const EMPTY: FriendsData = { friends: [], incoming: [], outgoing: [] };

/** "just now" / "5m ago" / "3d ago" — a light status ticker for the list. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const rowCls =
  "flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2";
const smallBtn =
  "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50";

export default function FriendsTab({ refreshKey = 0, onChanged, onSelectProfile }: FriendsTabProps) {
  const [data, setData] = useState<FriendsData>(EMPTY);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Which friend's preview card is open, and whether to open it on hover.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [hoverCapable, setHoverCapable] = useState(false);

  useEffect(() => {
    setHoverCapable(window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/friends");
      if (!res.ok) return;
      const d = await res.json();
      setData({ friends: d.friends ?? [], incoming: d.incoming ?? [], outgoing: d.outgoing ?? [] });
    } catch {
      // keep stale
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const addFriend = async () => {
    const name = username.trim();
    if (!name) {
      setError("Enter a username to add.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Couldn't send request.");
        return;
      }
      setUsername("");
      setNotice(
        d.status === "accepted"
          ? `You're now friends with ${d.friend?.username ?? name}.`
          : `Request sent to ${d.friend?.username ?? name}.`,
      );
      await refresh();
      onChanged?.();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (friendshipId: string, action: "accept" | "decline") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await refresh();
        onChanged?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (friendshipId: string, label: string) => {
    if (!window.confirm(`Remove ${label}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
      if (res.ok) {
        await refresh();
        onChanged?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-scroll flex-1 overflow-y-auto px-3 pb-4">
      {/* Add by username */}
      <div className="pt-3">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Add a friend
        </label>
        <div className="flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addFriend();
            }}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
          />
          <button
            onClick={addFriend}
            disabled={busy}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
        {notice && <p className="mt-1.5 text-xs text-emerald-300">{notice}</p>}
      </div>

      {/* Incoming requests */}
      {data.incoming.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-violet-300/90">
            Requests · {data.incoming.length}
          </h3>
          <ul className="space-y-1.5">
            {data.incoming.map((r) => (
              <li key={r.friendshipId} className={rowCls}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-200">{r.user.username}</span>
                  <span className="block text-[11px] text-slate-500">
                    wants to be friends · {relativeTime(r.createdAt)}
                  </span>
                </span>
                <button
                  onClick={() => respond(r.friendshipId, "accept")}
                  disabled={busy}
                  className={`${smallBtn} bg-emerald-500/90 text-slate-950 hover:bg-emerald-400`}
                >
                  Accept
                </button>
                <button
                  onClick={() => respond(r.friendshipId, "decline")}
                  disabled={busy}
                  className={`${smallBtn} border border-slate-600 text-slate-400 hover:text-rose-300`}
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Active friends */}
      <section className="mt-4">
        <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Friends · {data.friends.length}
        </h3>
        {data.friends.length === 0 ? (
          <p className="px-1 text-sm text-slate-500">
            No friends yet. Add someone by their username above.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data.friends.map((f) => {
              const open = previewId === f.friendshipId;
              return (
                <li
                  key={f.friendshipId}
                  onMouseLeave={hoverCapable ? () => setPreviewId(null) : undefined}
                >
                  <div className={rowCls}>
                    {/* Trigger: hover (desktop) or tap (mobile) reveals the preview card. */}
                    <button
                      type="button"
                      onMouseEnter={hoverCapable ? () => setPreviewId(f.friendshipId) : undefined}
                      onClick={
                        hoverCapable
                          ? () => onSelectProfile?.(f.user)
                          : () => setPreviewId(open ? null : f.friendshipId)
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={open}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500/15 text-sm font-semibold uppercase text-amber-300">
                        {f.user.username.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-200">{f.user.username}</span>
                        <span className="block text-[11px] text-slate-500">added {relativeTime(f.since)}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => remove(f.friendshipId, f.user.username)}
                      disabled={busy}
                      className={`${smallBtn} border border-slate-600 text-slate-400 hover:text-rose-300`}
                    >
                      Remove
                    </button>
                  </div>
                  {open && (
                    <ProfilePreviewCard
                      friend={f.user}
                      onViewMap={() => {
                        onSelectProfile?.(f.user);
                        setPreviewId(null);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Outgoing pending */}
      {data.outgoing.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Pending · {data.outgoing.length}
          </h3>
          <ul className="space-y-1.5">
            {data.outgoing.map((r) => (
              <li key={r.friendshipId} className={rowCls}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-300">{r.user.username}</span>
                  <span className="block text-[11px] text-slate-500">
                    requested · {relativeTime(r.createdAt)}
                  </span>
                </span>
                <button
                  onClick={() => remove(r.friendshipId, `your request to ${r.user.username}`)}
                  disabled={busy}
                  className={`${smallBtn} border border-slate-600 text-slate-400 hover:text-rose-300`}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
