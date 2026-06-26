"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminStats {
  users: { total: number; recentSignups: number };
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
  providers: { flightApi: boolean; tequila: boolean; travelpayouts?: boolean; airlabs: boolean; flightProviderMode?: string };
  extras: {
    imageCacheEntries: number;
    cardProfiles: number;
    loyaltyBalances: number;
  };
  database: { status: string };
}

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  imageUrl: string | null;
  createdAt: string;
  onboarded: boolean;
  _count: {
    locations: number;
    journalEntries: number;
    trips: number;
    watches: number;
    createdBoards: number;
    boardDeals: number;
  };
}

interface ActivityEvent {
  id: string;
  type: string;
  username: string | null;
  userImage: string | null;
  timestamp: string;
  details: string;
}

interface ActivityData {
  events: ActivityEvent[];
  summary: {
    totalEvents: number;
    searches: number;
    signups: number;
    locationsAdded: number;
    journalEntries: number;
    watchesCreated: number;
    dealsSaved: number;
  };
}

type TabId = "users" | "content" | "system" | "activity";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${accent ? "text-amber-400" : "text-slate-100"}`}
      >
        {value}
      </p>
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    OWNER: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    EDITOR: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    VIEWER: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[role] ?? colors.VIEWER}`}
    >
      {role}
    </span>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Users
// ---------------------------------------------------------------------------

function UsersTab({ users, onRefresh }: { users: AdminUser[]; onRefresh: () => void }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(userId: string, newRole: string) {
    setActionLoading(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
      setDeleteTarget(null);
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
      setDeleteTarget(null);
    } finally {
      setActionLoading(null);
    }
  }

  const totalContent = users.reduce(
    (sum, u) =>
      sum + u._count.locations + u._count.journalEntries + u._count.trips,
    0,
  );

  // Sort: most content first for "most active" display
  const sortedByActivity = [...users].sort(
    (a, b) =>
      b._count.locations +
      b._count.journalEntries +
      b._count.trips -
      (a._count.locations + a._count.journalEntries + a._count.trips),
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Users" value={users.length} accent />
        <StatCard
          label="Owners"
          value={users.filter((u) => u.role === "OWNER").length}
        />
        <StatCard
          label="Editors"
          value={users.filter((u) => u.role === "EDITOR").length}
        />
        <StatCard
          label="Viewers"
          value={users.filter((u) => u.role === "VIEWER").length}
        />
      </div>

      {/* User table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden md:table-cell">
                Joined
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">
                Content
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedByActivity.map((user) => {
              const contentCount =
                user._count.locations +
                user._count.journalEntries +
                user._count.trips;
              const isLoading = actionLoading === user.id;

              return (
                <tr
                  key={user.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.imageUrl ? (
                        <img
                          src={user.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-300">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-200">
                          {user.username}
                        </p>
                        {user.onboarded && (
                          <p className="text-xs text-emerald-500">onboarded</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">
                    {user.email || "--"}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                    {fmtDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 hidden lg:table-cell">
                    <span title={`${user._count.locations} locations, ${user._count.journalEntries} journals, ${user._count.trips} trips`}>
                      {contentCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {isLoading ? (
                        <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleRoleChange(user.id, e.target.value)
                            }
                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:border-amber-500 focus:outline-none"
                          >
                            <option value="OWNER">Owner</option>
                            <option value="EDITOR">Editor</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          <button
                            onClick={() => setDeleteTarget(user)}
                            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 hover:border-red-700 transition"
                            title="Delete user"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            No users found.
          </p>
        )}
      </div>

      {/* Most Active Users */}
      {totalContent > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Most Active Users
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedByActivity.slice(0, 6).map((user) => {
              const c = user._count;
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-slate-300">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-200">
                      {user.username}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.locations} locations, {c.journalEntries} journals,{" "}
                      {c.trips} trips
                    </p>
                  </div>
                  <RoleBadge role={user.role} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete User"
          message={`Are you sure you want to permanently delete "${deleteTarget.username}" and all their data? This cannot be undone.`}
          confirmLabel="Delete User"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Content
// ---------------------------------------------------------------------------

function ContentTab({ stats }: { stats: AdminStats }) {
  return (
    <div className="space-y-6">
      {/* Content counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Locations" value={stats.content.locations} accent />
        <StatCard label="Journal Entries" value={stats.content.journals} />
        <StatCard label="Trips" value={stats.content.trips} />
        <StatCard label="Boards" value={stats.content.boards} />
        <StatCard
          label="Board Deals"
          value={stats.content.boardDeals}
        />
        <StatCard
          label="Watches"
          value={stats.watches.total}
          sub={`${stats.watches.active} active`}
        />
      </div>

      {/* Additional data */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Image Cache" value={stats.extras?.imageCacheEntries ?? 0} sub="cached searches" />
        <StatCard label="Card Profiles" value={stats.extras?.cardProfiles ?? 0} />
        <StatCard label="Loyalty Balances" value={stats.extras?.loyaltyBalances ?? 0} />
        <StatCard
          label="Analytics Events"
          value={stats.analytics.totalEvents.toLocaleString()}
          sub={`${stats.analytics.searches} searches`}
        />
      </div>

      {/* Fare Cache Coverage */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Fare Cache Coverage by Origin
        </h3>
        {stats.cache.coverageByOrigin.length === 0 ? (
          <p className="text-sm text-slate-500">No cached fares yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: System
// ---------------------------------------------------------------------------

function SystemTab({ stats }: { stats: AdminStats }) {
  const authConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <div className="space-y-6">
      {/* Database & Cache */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Database & Cache
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Database"
            value={stats.database.status === "connected" ? "Online" : "Error"}
            sub={stats.database.status}
            accent={stats.database.status === "connected"}
          />
          <StatCard
            label="Cached Fares"
            value={stats.cache.totalFares.toLocaleString()}
            sub={`Last: ${fmtDateTime(stats.cache.newestEntry)}`}
          />
          <StatCard
            label="Oldest Cache"
            value={stats.cache.oldestEntry ? fmtDate(stats.cache.oldestEntry) : "--"}
          />
          <StatCard label="Total Users" value={stats.users.total} />
        </div>
      </div>

      {/* API Provider Status */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">
          API Providers
        </h3>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 divide-y divide-slate-800">
          {[
            {
              name: "Supabase (Auth)",
              ok: authConfigured,
              description: "User authentication and session management",
            },
            {
              name: "Travelpayouts (Fare Data)",
              ok: !!stats.providers.travelpayouts,
              description: `Flight deal pricing — mode: ${stats.providers.flightProviderMode ?? "kiwi"}`,
            },
            {
              name: "Flight API (Tequila/Kiwi)",
              ok: stats.providers.tequila,
              description: "Flight search and fare data",
            },
            {
              name: "Flight API (Generic)",
              ok: stats.providers.flightApi,
              description: "Flight data provider",
            },
            {
              name: "AirLabs (Flight Tracker)",
              ok: stats.providers.airlabs,
              description: "Real-time flight tracking",
            },
          ].map((provider) => (
            <div
              key={provider.name}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <StatusDot ok={provider.ok} />
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {provider.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {provider.description}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs font-medium ${provider.ok ? "text-emerald-400" : "text-slate-600"}`}
              >
                {provider.ok ? "Configured" : "Not Set"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* System Info */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">
          System Info
        </h3>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500 uppercase">Framework</p>
              <p className="text-sm text-slate-300">Next.js (App Router)</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Database</p>
              <p className="text-sm text-slate-300">Supabase PostgreSQL</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Auth Provider</p>
              <p className="text-sm text-slate-300">Supabase + Legacy Fallback</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Cache Origins</p>
              <p className="text-sm text-slate-300">
                {stats.cache.coverageByOrigin.length} airports
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Activity
// ---------------------------------------------------------------------------

const EVENT_STYLES: Record<string, { dot: string; label: string }> = {
  search: { dot: "bg-blue-400", label: "Search" },
  signup: { dot: "bg-emerald-400", label: "Signup" },
  location_added: { dot: "bg-amber-400", label: "Location" },
  journal_entry: { dot: "bg-purple-400", label: "Journal" },
  watch_created: { dot: "bg-cyan-400", label: "Watch" },
  deal_saved: { dot: "bg-rose-400", label: "Deal" },
};

function ActivityTab({
  activity,
  loading: actLoading,
}: {
  activity: ActivityData | null;
  loading: boolean;
}) {
  if (actLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Loading activity...
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Failed to load activity data.
      </p>
    );
  }

  const { events, summary } = activity;

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Total Events" value={summary.totalEvents} accent />
        <StatCard label="Searches" value={summary.searches} />
        <StatCard label="Signups" value={summary.signups} />
        <StatCard label="Locations" value={summary.locationsAdded} />
        <StatCard label="Journals" value={summary.journalEntries} />
        <StatCard label="Watches" value={summary.watchesCreated} />
        <StatCard label="Deals" value={summary.dealsSaved} />
      </div>

      {/* Timeline */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Recent Activity (last 50 events)
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        ) : (
          <div className="rounded-xl border border-slate-800 divide-y divide-slate-800/50">
            {events.map((ev) => {
              const style = EVENT_STYLES[ev.type] ?? {
                dot: "bg-slate-500",
                label: ev.type,
              };
              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 transition"
                >
                  {/* Colored dot */}
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                  />

                  {/* Type badge */}
                  <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400 w-16 text-center">
                    {style.label}
                  </span>

                  {/* User avatar + name */}
                  <div className="flex items-center gap-2 shrink-0 w-28">
                    {ev.userImage ? (
                      <img
                        src={ev.userImage}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-medium text-slate-400">
                        {ev.username?.charAt(0).toUpperCase() ?? "?"}
                      </div>
                    )}
                    <span className="text-sm text-slate-300 truncate">
                      {ev.username ?? "anonymous"}
                    </span>
                  </div>

                  {/* Details */}
                  <span className="flex-1 text-sm text-slate-400 truncate">
                    {ev.details}
                  </span>

                  {/* Timestamp */}
                  <span className="shrink-0 text-xs text-slate-600">
                    {fmtDateTime(ev.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("users");

  const loadStats = useCallback(() => {
    return fetch("/api/admin/stats")
      .then((r) => {
        if (!r.ok)
          throw new Error(
            r.status === 403 ? "Access denied" : "Failed to load stats",
          );
        return r.json();
      })
      .then((d) => setStats(d.stats));
  }, []);

  const loadUsers = useCallback(() => {
    return fetch("/api/admin/users")
      .then((r) => {
        if (!r.ok)
          throw new Error(
            r.status === 403 ? "Access denied" : "Failed to load users",
          );
        return r.json();
      })
      .then((d) => setUsers(d.users));
  }, []);

  const loadActivity = useCallback(() => {
    setActivityLoading(true);
    return fetch("/api/admin/activity")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load activity");
        return r.json();
      })
      .then((d) => setActivity(d))
      .finally(() => setActivityLoading(false));
  }, []);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([loadStats(), loadUsers(), loadActivity()])
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [loadStats, loadUsers, loadActivity]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-6 text-center max-w-sm">
          <p className="text-red-400 font-medium">{error}</p>
          <p className="mt-2 text-sm text-slate-500">
            Only owners can access this page.
          </p>
        </div>
        <Link href="/" className="text-sm text-amber-400 hover:underline">
          Back to app
        </Link>
      </div>
    );
  }

  if (!stats) return null;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "users", label: "Users", count: users.length },
    { id: "content", label: "Content" },
    { id: "activity", label: "Activity", count: activity?.events.length },
    { id: "system", label: "System" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-amber-400">
              TravelBoard Admin
            </h1>
            <p className="text-xs text-slate-500">
              {stats.users.total} users | {stats.users.recentSignups} new this
              week
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadAll}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
              title="Refresh data"
            >
              Refresh
            </button>
            <Link
              href="/"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
            >
              Back to app
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="mx-auto max-w-6xl px-6">
          <nav className="flex gap-1" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "text-amber-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs ${
                      activeTab === tab.id
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="mx-auto max-w-6xl p-6">
        {activeTab === "users" && (
          <UsersTab users={users} onRefresh={loadAll} />
        )}
        {activeTab === "content" && <ContentTab stats={stats} />}
        {activeTab === "activity" && (
          <ActivityTab activity={activity} loading={activityLoading} />
        )}
        {activeTab === "system" && <SystemTab stats={stats} />}
      </main>
    </div>
  );
}
