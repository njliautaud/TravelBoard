"use client";

import { useCallback, useEffect, useState } from "react";
import { DEMO_CARDS } from "@/lib/demoData";

interface CardProfile {
  id: string;
  cardName: string;
  issuer: string | null;
  pointsBalance: number;
  annualFee: number | null;
  category: string | null;
  createdAt: string;
}

const KNOWN_CARDS = [
  { id: "chase_sapphire_reserve", name: "Chase Sapphire Reserve", issuer: "Chase" },
  { id: "chase_sapphire_preferred", name: "Chase Sapphire Preferred", issuer: "Chase" },
  { id: "chase_freedom_flex", name: "Chase Freedom Flex", issuer: "Chase" },
  { id: "amex_platinum", name: "Amex Platinum", issuer: "Amex" },
  { id: "amex_gold", name: "Amex Gold", issuer: "Amex" },
  { id: "capital_one_venture_x", name: "Capital One Venture X", issuer: "Capital One" },
  { id: "capital_one_venture", name: "Capital One Venture", issuer: "Capital One" },
  { id: "citi_premier", name: "Citi Premier", issuer: "Citi" },
];

export default function CardManager() {
  const [cards, setCards] = useState<CardProfile[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ cardName: "", issuer: "", pointsBalance: "", annualFee: "", category: "" });

  const loadCards = useCallback(async () => {
    try {
      const res = await fetch("/api/points/cards");
      if (res.ok) {
        const data = await res.json();
        const items = data.cards ?? [];
        if (items.length > 0) {
          setCards(items);
          setUsingDemo(false);
          return;
        }
      }
      setCards(DEMO_CARDS);
      setUsingDemo(true);
    } catch {
      setCards(DEMO_CARDS);
      setUsingDemo(true);
    }
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  function resetForm() {
    setForm({ cardName: "", issuer: "", pointsBalance: "", annualFee: "", category: "" });
    setShowAdd(false);
    setEditId(null);
  }

  async function handleSave() {
    if (!form.cardName.trim()) return;
    const body = {
      cardName: form.cardName,
      issuer: form.issuer || undefined,
      pointsBalance: form.pointsBalance ? parseInt(form.pointsBalance) : 0,
      annualFee: form.annualFee ? parseFloat(form.annualFee) : undefined,
      category: form.category || undefined,
    };

    if (editId) {
      await fetch(`/api/points/cards/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/points/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    resetForm();
    loadCards();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/points/cards/${id}`, { method: "DELETE" });
    loadCards();
  }

  function startEdit(card: CardProfile) {
    setEditId(card.id);
    setForm({
      cardName: card.cardName,
      issuer: card.issuer ?? "",
      pointsBalance: String(card.pointsBalance),
      annualFee: card.annualFee != null ? String(card.annualFee) : "",
      category: card.category ?? "",
    });
    setShowAdd(true);
  }

  function selectKnownCard(id: string) {
    const known = KNOWN_CARDS.find((c) => c.id === id);
    if (known) {
      setForm((prev) => ({ ...prev, cardName: known.id, issuer: known.issuer }));
    }
  }

  const totalPoints = cards.reduce((sum, c) => sum + c.pointsBalance, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Total points across all cards</span>
            {usingDemo && (
              <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400">Sample data</span>
            )}
          </div>
          <p className="text-2xl font-bold text-amber-400">{totalPoints.toLocaleString()}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400"
        >
          + Add Card
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">{editId ? "Edit Card" : "Add Card"}</h4>

          {/* Quick select from known cards */}
          {!editId && (
            <div className="flex flex-wrap gap-1">
              {KNOWN_CARDS.map((kc) => (
                <button
                  key={kc.id}
                  onClick={() => selectKnownCard(kc.id)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                    form.cardName === kc.id
                      ? "border-amber-500 bg-amber-500/10 text-amber-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {kc.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={form.cardName}
              onChange={(e) => setForm((p) => ({ ...p, cardName: e.target.value }))}
              placeholder="Card name or ID"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <input
              value={form.issuer}
              onChange={(e) => setForm((p) => ({ ...p, issuer: e.target.value }))}
              placeholder="Issuer (Chase, Amex...)"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <input
              value={form.pointsBalance}
              onChange={(e) => setForm((p) => ({ ...p, pointsBalance: e.target.value }))}
              placeholder="Points balance"
              type="number"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <input
              value={form.annualFee}
              onChange={(e) => setForm((p) => ({ ...p, annualFee: e.target.value }))}
              placeholder="Annual fee"
              type="number"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!form.cardName.trim()}
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

      {/* Card List */}
      {cards.length === 0 && !showAdd ? (
        <p className="text-center text-sm text-slate-500 py-8">
          No cards yet. Add your credit cards to track points and find optimal transfer paths.
        </p>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => {
            const isDemo = card.id.startsWith("demo-");
            return (
              <div
                key={card.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{card.cardName}</p>
                  <p className="text-xs text-slate-500">
                    {card.issuer ?? "Unknown issuer"}
                    {card.annualFee != null && ` · $${card.annualFee}/yr`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-sm font-semibold text-amber-400">
                      {card.pointsBalance.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500 block">points</span>
                  </div>
                  {!isDemo && (
                    <>
                      <button
                        onClick={() => startEdit(card)}
                        className="rounded p-1 text-slate-500 transition hover:text-slate-300"
                        title="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(card.id)}
                        className="rounded p-1 text-slate-500 transition hover:text-red-400"
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
