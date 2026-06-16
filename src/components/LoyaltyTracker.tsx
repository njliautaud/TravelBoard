"use client";

import { useCallback, useEffect, useState } from "react";

interface LoyaltyBalance {
  id: string;
  programName: string;
  programCode: string | null;
  balance: number;
  tier: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export default function LoyaltyTracker() {
  const [balances, setBalances] = useState<LoyaltyBalance[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ programName: "", programCode: "", balance: "", tier: "", expiresAt: "" });

  const loadBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/loyalty");
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances ?? []);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  function resetForm() {
    setForm({ programName: "", programCode: "", balance: "", tier: "", expiresAt: "" });
    setShowAdd(false);
    setEditId(null);
  }

  async function handleSave() {
    if (!form.programName.trim()) return;
    const body = {
      programName: form.programName,
      programCode: form.programCode || undefined,
      balance: form.balance ? parseInt(form.balance) : 0,
      tier: form.tier || undefined,
      expiresAt: form.expiresAt || undefined,
    };

    if (editId) {
      await fetch(`/api/loyalty/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    resetForm();
    loadBalances();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/loyalty/${id}`, { method: "DELETE" });
    loadBalances();
  }

  function startEdit(b: LoyaltyBalance) {
    setEditId(b.id);
    setForm({
      programName: b.programName,
      programCode: b.programCode ?? "",
      balance: String(b.balance),
      tier: b.tier ?? "",
      expiresAt: b.expiresAt ? b.expiresAt.slice(0, 10) : "",
    });
    setShowAdd(true);
  }

  function isExpiringSoon(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    const daysUntil = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
    return daysUntil > 0 && daysUntil < 90;
  }

  function isExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  }

  const totalMiles = balances.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500">Total across all programs</span>
          <p className="text-2xl font-bold text-amber-400">{totalMiles.toLocaleString()}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400"
        >
          + Add Program
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">{editId ? "Edit Program" : "Add Loyalty Program"}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={form.programName}
              onChange={(e) => setForm((p) => ({ ...p, programName: e.target.value }))}
              placeholder="Program name (e.g., United MileagePlus)"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none sm:col-span-2"
            />
            <input
              value={form.programCode}
              onChange={(e) => setForm((p) => ({ ...p, programCode: e.target.value }))}
              placeholder="Code (optional, e.g. UA)"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <input
              value={form.balance}
              onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))}
              placeholder="Balance"
              type="number"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <input
              value={form.tier}
              onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value }))}
              placeholder="Tier (e.g. Gold, Platinum)"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <input
              value={form.expiresAt}
              onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
              type="date"
              placeholder="Expiration date"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!form.programName.trim()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {editId ? "Update" : "Add"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Balances List */}
      {balances.length === 0 && !showAdd ? (
        <p className="text-center text-sm text-slate-500 py-8">
          No loyalty programs tracked yet. Add your airline and hotel programs to keep track of balances and expirations.
        </p>
      ) : (
        <div className="space-y-2">
          {balances.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-200">{b.programName}</p>
                  {b.tier && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">{b.tier}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {b.programCode && <span>{b.programCode}</span>}
                  {b.expiresAt && (
                    isExpired(b.expiresAt) ? (
                      <span className="text-red-400">Expired {new Date(b.expiresAt).toLocaleDateString()}</span>
                    ) : isExpiringSoon(b.expiresAt) ? (
                      <span className="text-amber-400">Expires {new Date(b.expiresAt).toLocaleDateString()}</span>
                    ) : (
                      <span>Expires {new Date(b.expiresAt).toLocaleDateString()}</span>
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-sm font-semibold text-amber-400">
                    {b.balance.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500 block">points</span>
                </div>
                <button
                  onClick={() => startEdit(b)}
                  className="rounded p-1 text-slate-500 transition hover:text-slate-300"
                  title="Edit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="rounded p-1 text-slate-500 transition hover:text-red-400"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
