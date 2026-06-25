"use client";

/**
 * AlertsPanel — shows active watches with target/current prices,
 * alert history, and a quick-add watch form. Includes a bell icon
 * badge component for the AppShell header.
 */

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types matching API responses
// ---------------------------------------------------------------------------

interface WatchItem {
  id: string;
  origin: string;
  destinationCode: string;
  targetPrice: number;
  currency: string;
  active: boolean;
  lastChecked: string | null;
  lastAlertedAt: string | null;
  createdAt: string;
  currentBestPrice?: number | null;
}

interface AlertItem {
  id: string;
  watchId: string;
  price: number;
  source: string | null;
  triggeredAt: string;
  origin?: string;
  destinationCode?: string;
  targetPrice?: number;
}

function fmtPrice(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Bell icon badge (exported for AppShell header)
// ---------------------------------------------------------------------------

export function AlertBellBadge({ count }: { count: number }) {
  return (
    <div className="relative">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950 px-1">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick-add watch form
// ---------------------------------------------------------------------------

function QuickAddWatch({ onCreated }: { onCreated: () => void }) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [target, setTarget] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !dest.trim() || !target.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin: origin.trim().toUpperCase(),
          destinationCode: dest.trim().toUpperCase(),
          targetPrice: parseFloat(target),
        }),
      });
      if (res.ok) {
        setOrigin("");
        setDest("");
        setTarget("");
        onCreated();
      } else {
        const d = await res.json();
        setError(d.error ?? "Failed to create watch");
      }
    } catch {
      setError("Request failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-slate-500 uppercase">From</label>
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="w-16 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 border border-slate-700 focus:border-amber-500/50 outline-none"
          placeholder="MCO"
          maxLength={3}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-slate-500 uppercase">To</label>
        <input
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          className="w-16 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 border border-slate-700 focus:border-amber-500/50 outline-none"
          placeholder="NRT"
          maxLength={3}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-slate-500 uppercase">Target $</label>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          type="number"
          min="1"
          className="w-20 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 border border-slate-700 focus:border-amber-500/50 outline-none"
          placeholder="500"
        />
      </div>
      <button
        type="submit"
        disabled={creating}
        className="rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-1 text-xs font-medium transition border border-amber-500/30 disabled:opacity-50"
      >
        {creating ? "..." : "+ Watch"}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main AlertsPanel
// ---------------------------------------------------------------------------

export default function AlertsPanel() {
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoadError(false);
      const [watchRes, alertRes] = await Promise.all([
        fetch("/api/watches").then((r) => r.json()),
        fetch("/api/alerts").then((r) => r.json()),
      ]);
      setWatches(watchRes.watches ?? []);
      setAlerts(alertRes.alerts ?? []);
      setUnreadCount(alertRes.unreadCount ?? 0);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const removeWatch = async (id: string) => {
    await fetch(`/api/watches/${id}`, { method: "DELETE" });
    loadData();
  };

  const toggleWatch = async (id: string, active: boolean) => {
    await fetch(`/api/watches/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    loadData();
  };

  const ackAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}/ack`, { method: "POST" });
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mr-2" />
        Loading watches...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-red-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-sm text-slate-400">Could not load watches and alerts.</p>
        <button
          onClick={() => { setLoading(true); loadData(); }}
          className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <AlertBellBadge count={unreadCount} />
            Price Watches & Alerts
          </h2>
          <span className="text-[10px] text-slate-500">
            {watches.length} watch{watches.length === 1 ? "" : "es"} active
          </span>
        </div>
        <QuickAddWatch onCreated={loadData} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Active watches */}
        <div>
          <h3 className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-2">
            Active Watches
          </h3>
          {watches.length === 0 ? (
            <p className="text-xs text-slate-600 italic">
              No watches yet. Add one above or click &ldquo;Watch this route&rdquo; from
              search results.
            </p>
          ) : (
            <div className="space-y-1.5">
              {watches.map((w) => {
                const below =
                  w.currentBestPrice != null &&
                  w.currentBestPrice <= w.targetPrice;
                return (
                  <div
                    key={w.id}
                    className={`flex items-center gap-3 rounded-lg p-2.5 border ${
                      below
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-slate-900/50 border-slate-800"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-200">
                          {w.origin} -&gt; {w.destinationCode}
                        </span>
                        {!w.active && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-400">
                            paused
                          </span>
                        )}
                        {below && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                            below target!
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex gap-3">
                        <span>
                          Target: {fmtPrice(w.targetPrice)}
                        </span>
                        <span>
                          Current:{" "}
                          {w.currentBestPrice != null
                            ? fmtPrice(w.currentBestPrice)
                            : "no data"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleWatch(w.id, w.active)}
                        className="text-xs px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                        title={w.active ? "Pause watch" : "Resume watch"}
                      >
                        {w.active ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWatch(w.id)}
                        className="text-xs px-2 py-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                        title="Delete watch"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alert history */}
        <div>
          <h3 className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-2">
            Recent Alerts
          </h3>
          {alerts.length === 0 ? (
            <p className="text-xs text-slate-600 italic">
              No alerts yet. You will see price drop alerts here when watched
              routes fall below your target.
            </p>
          ) : (
            <div className="space-y-1">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg p-2 bg-slate-900/30 border border-slate-800/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-300">
                      {a.origin ?? "?"} -&gt; {a.destinationCode ?? "?"} dropped
                      to {fmtPrice(a.price)}
                      {a.targetPrice != null && (
                        <span className="text-slate-500">
                          {" "}(target {fmtPrice(a.targetPrice)})
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {relativeTime(a.triggeredAt)}
                      {a.source ? ` -- ${a.source}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => ackAlert(a.id)}
                    className="text-[10px] px-2 py-0.5 rounded text-slate-500 hover:text-amber-300 hover:bg-slate-800 transition"
                    title="Acknowledge"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
