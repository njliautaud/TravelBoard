"use client";

import { useEffect, useState } from "react";
import type { FriendUser, ProfileStats } from "@/lib/types";

interface ProfilePreviewCardProps {
  friend: FriendUser;
  onViewMap: () => void;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-slate-800/60 px-2 py-1.5">
      <span className="text-base font-bold text-slate-100">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}

/**
 * Aggregated stats card shown when previewing a friend (hover on desktop,
 * tap on mobile — the trigger is handled by the parent). Styled to blend with
 * the sidebar's slate/amber design system.
 */
export default function ProfilePreviewCard({ friend, onViewMap }: ProfilePreviewCardProps) {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setError(false);
    (async () => {
      try {
        const res = await fetch(`/api/users/${friend.id}/stats`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.stats) setStats(data.stats);
        else setError(true);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [friend.id]);

  return (
    <div className="mt-1.5 rounded-xl border border-slate-700/70 bg-slate-900/95 p-3 shadow-xl">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-sm font-semibold uppercase text-amber-300">
          {friend.username.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{friend.username}</p>
          <p className="text-[11px] text-slate-500">
            {error ? "Stats unavailable" : stats ? `${stats.countries} countries` : "Loading…"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Stat value={stats?.total ?? 0} label="Places" />
        <Stat value={stats?.visited ?? 0} label="Visited" />
        <Stat value={stats?.toVisit ?? 0} label="Wished" />
      </div>

      <button
        onClick={onViewMap}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        View map
      </button>
    </div>
  );
}
