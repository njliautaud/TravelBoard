"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminStats {
  users: { total: number };
  content: {
    locations: number;
    journals: number;
    trips: number;
    boards: number;
    boardDeals: number;
  };
  watches: { total: number; active: number };
  cache: {
    totalFares: number;
    oldestEntry: string | null;
    newestEntry: string | null;
    coverageByOrigin: { origin: string; count: number }[];
  };
  analytics: { totalEvents: number; searches: number };
  providers: { flightApi: boolean; tequila: boolean; airlabs: boolean };
  database: { status: string };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-600"}`}
    />
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "Access denied" : "Failed to load");
        return r.json();
      })
      .then((d) => {
        setStats(d.stats);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Loading admin dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950">
        <p className="text-red-400">{error}</p>
        <Link href="/" className="text-sm text-amber-400 underline">
          Back to app
        </Link>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-amber-400">
              TravelBoard Admin
            </h1>
            <p className="text-xs text-slate-500">System overview</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6 space-y-8">
        {/* System Health */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">
            System Health
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Database"
              value={stats.database.status === "connected" ? "Online" : "Error"}
              sub={stats.database.status}
            />
            <StatCard
              label="Cached Fares"
              value={stats.cache.totalFares.toLocaleString()}
              sub={`Last warm: ${fmtDate(stats.cache.newestEntry)}`}
            />
            <StatCard
              label="Oldest Cache"
              value={stats.cache.oldestEntry ? fmtDate(stats.cache.oldestEntry) : "--"}
            />
            <StatCard
              label="Analytics Events"
              value={stats.analytics.totalEvents.toLocaleString()}
              sub={`${stats.analytics.searches} searches`}
            />
          </div>
        </section>

        {/* Provider Status */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Provider Status
          </h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <StatusDot ok={stats.providers.flightApi} />
                <span className="text-sm text-slate-300">Flight API</span>
                <span className="text-xs text-slate-500">
                  {stats.providers.flightApi ? "configured" : "not set"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot ok={stats.providers.tequila} />
                <span className="text-sm text-slate-300">Tequila / Kiwi</span>
                <span className="text-xs text-slate-500">
                  {stats.providers.tequila ? "configured" : "not set"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot ok={stats.providers.airlabs} />
                <span className="text-sm text-slate-300">AirLabs (tracker)</span>
                <span className="text-xs text-slate-500">
                  {stats.providers.airlabs ? "configured" : "not set"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* User & Content Stats */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Users & Content
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <StatCard label="Users" value={stats.users.total} />
            <StatCard label="Locations" value={stats.content.locations} />
            <StatCard label="Journal Entries" value={stats.content.journals} />
            <StatCard label="Trips" value={stats.content.trips} />
            <StatCard
              label="Watches"
              value={stats.watches.total}
              sub={`${stats.watches.active} active`}
            />
            <StatCard
              label="Boards"
              value={stats.content.boards}
              sub={`${stats.content.boardDeals} deals shared`}
            />
          </div>
        </section>

        {/* Cache Coverage */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Fare Cache Coverage by Origin
          </h2>
          {stats.cache.coverageByOrigin.length === 0 ? (
            <p className="text-sm text-slate-500">No cached fares yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                      Origin
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                      Fares Cached
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.cache.coverageByOrigin.map((row) => (
                    <tr
                      key={row.origin}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-2 font-mono text-amber-400">
                        {row.origin}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-300">
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
