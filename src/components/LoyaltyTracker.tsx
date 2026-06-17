"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types (mirrors @travelboard/core + API shapes)
// ---------------------------------------------------------------------------

interface LoyaltyBalance {
  id: string;
  programName: string;
  programCode: string | null;
  balance: number;
  tier: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

interface PointsProgram {
  id: string;
  name: string;
  baselineCpp: number;
}

interface TransferPartner {
  id: string;
  name: string;
  kind: "airline" | "hotel";
  family?: string;
}

interface TransferEdge {
  program: string;
  partner: string;
  ratio: number;
}

interface CardDefinition {
  id: string;
  name: string;
  issuer: string;
  program: string;
  transferEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = "tracked" | "all" | "cards";
type PartnerCategory = "airline" | "hotel";

export default function LoyaltyTracker() {
  // User's tracked balances
  const [balances, setBalances] = useState<LoyaltyBalance[]>([]);

  // Full catalog from core
  const [programs, setPrograms] = useState<PointsProgram[]>([]);
  const [partners, setPartners] = useState<TransferPartner[]>([]);
  const [edges, setEdges] = useState<TransferEdge[]>([]);
  const [cardCatalog, setCardCatalog] = useState<CardDefinition[]>([]);

  // User's held cards (card IDs)
  const [heldCards, setHeldCards] = useState<Set<string>>(new Set());

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("tracked");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PartnerCategory | "all">("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ programName: "", programCode: "", balance: "", tier: "", expiresAt: "" });

  // ── Load user balances ────────────────────────────────────────────────────
  const loadBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/loyalty");
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances ?? []);
      }
    } catch {
      // API unavailable — keep empty
    }
  }, []);

  // ── Load full program catalog ─────────────────────────────────────────────
  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/loyalty/programs");
      if (!res.ok) return;
      const data = await res.json();
      setPrograms(data.programs ?? []);
      setPartners(data.partners ?? []);
      setEdges(data.edges ?? []);
      setCardCatalog(data.cards ?? []);
    } catch {
      // silent — catalog is enhancement, not critical
    }
  }, []);

  // ── Load user's cards ─────────────────────────────────────────────────────
  const loadHeldCards = useCallback(async () => {
    try {
      const res = await fetch("/api/points/cards");
      if (!res.ok) return;
      const data = await res.json();
      const cards: Array<{ cardName: string; category: string }> = data.cards ?? [];
      // Match card names to catalog IDs
      const ids = new Set<string>();
      for (const c of cards) {
        const match = cardCatalog.find(
          (cat) => cat.name === c.cardName || cat.id === c.cardName,
        );
        if (match) ids.add(match.id);
      }
      setHeldCards(ids);
    } catch {
      // silent
    }
  }, [cardCatalog]);

  useEffect(() => { loadBalances(); loadCatalog(); }, [loadBalances, loadCatalog]);
  useEffect(() => { if (cardCatalog.length > 0) loadHeldCards(); }, [cardCatalog, loadHeldCards]);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Programs unlocked by held cards (transfer-enabled only)
  const unlockedPrograms = useMemo(() => {
    const pSet = new Set<string>();
    for (const cardId of heldCards) {
      const card = cardCatalog.find((c) => c.id === cardId);
      if (card?.transferEnabled) pSet.add(card.program);
    }
    return pSet;
  }, [heldCards, cardCatalog]);

  // Transfer map: partnerId -> array of { programId, programName, ratio }
  const transferMap = useMemo(() => {
    const map = new Map<string, Array<{ programId: string; programName: string; ratio: number }>>();
    for (const edge of edges) {
      if (!unlockedPrograms.has(edge.program)) continue;
      const prog = programs.find((p) => p.id === edge.program);
      if (!prog) continue;
      const arr = map.get(edge.partner) ?? [];
      arr.push({ programId: edge.program, programName: prog.name, ratio: edge.ratio });
      map.set(edge.partner, arr);
    }
    return map;
  }, [edges, unlockedPrograms, programs]);

  // All partners grouped and filtered
  const filteredPartners = useMemo(() => {
    let list = [...partners];

    if (categoryFilter !== "all") {
      list = list.filter((p) => p.kind === categoryFilter);
    }

    if (programFilter !== "all") {
      const partnerIds = new Set(
        edges.filter((e) => e.program === programFilter).map((e) => e.partner),
      );
      list = list.filter((p) => partnerIds.has(p.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.family && p.family.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [partners, categoryFilter, programFilter, edges, search]);

  // Group partners by kind for display
  const airlinePartners = useMemo(() => filteredPartners.filter((p) => p.kind === "airline"), [filteredPartners]);
  const hotelPartners = useMemo(() => filteredPartners.filter((p) => p.kind === "hotel"), [filteredPartners]);

  // Tracked program names set (for quick "already tracked" lookup)
  const trackedNames = useMemo(() => new Set(balances.map((b) => b.programName)), [balances]);

  const totalPoints = balances.reduce((sum, b) => sum + b.balance, 0);

  // ── Form handlers ─────────────────────────────────────────────────────────

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
    setActiveTab("tracked");
  }

  function quickAdd(name: string, code?: string) {
    setForm({ programName: name, programCode: code ?? "", balance: "", tier: "", expiresAt: "" });
    setShowAdd(true);
    setActiveTab("tracked");
  }

  // Card toggle
  function toggleCard(cardId: string) {
    setHeldCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function isExpiringSoon(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    const daysUntil = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
    return daysUntil > 0 && daysUntil < 90;
  }

  function isExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  }

  function ratioLabel(ratio: number): string {
    if (ratio === 1) return "1:1";
    if (ratio === 2) return "1:2";
    if (ratio < 1) return `1:${ratio}`;
    return `1:${ratio}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Total across {balances.length} tracked programs</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{totalPoints.toLocaleString()} <span className="text-sm font-normal text-slate-500">points</span></p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(true); setActiveTab("tracked"); }}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400"
        >
          + Add Program
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-900/60 p-1">
        {([
          ["tracked", `My Programs (${balances.length})`],
          ["all", `All Programs (${partners.length})`],
          ["cards", `My Cards (${heldCards.size})`],
        ] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === tab
                ? "bg-slate-700 text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Tracked balances ──────────────────────────────────────────── */}
      {activeTab === "tracked" && (
        <>
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
                  list="partner-suggestions"
                />
                <datalist id="partner-suggestions">
                  {partners.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
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

          {/* Tracked balances list */}
          {balances.length === 0 && !showAdd ? (
            <p className="text-center text-sm text-slate-500 py-8">
              No loyalty programs tracked yet. Click &quot;+ Add Program&quot; or browse &quot;All Programs&quot; to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {balances.map((b) => {
                return (
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
                        {/* Show transfer paths if we have catalog data */}
                        {(() => {
                          const partner = partners.find((p) => p.name === b.programName);
                          if (!partner) return null;
                          const paths = transferMap.get(partner.id);
                          if (!paths || paths.length === 0) return null;
                          return (
                            <span className="text-emerald-400">
                              via {paths.map((p) => p.programName.split(" ")[0]).join(", ")}
                            </span>
                          );
                        })()}
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
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: All Programs ──────────────────────────────────────────────── */}
      {activeTab === "all" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search programs..."
              className="flex-1 min-w-[180px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as PartnerCategory | "all")}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="airline">Airlines</option>
              <option value="hotel">Hotels</option>
            </select>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Card Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Card-accessible indicator */}
          {heldCards.size > 0 && (
            <p className="text-xs text-slate-500">
              Programs reachable from your cards are marked with a green border.
              {unlockedPrograms.size > 0 && ` You can transfer from ${[...unlockedPrograms].map((id) => programs.find((p) => p.id === id)?.name.split(" ")[0]).filter(Boolean).join(", ")}.`}
            </p>
          )}

          {/* Airlines */}
          {(categoryFilter === "all" || categoryFilter === "airline") && airlinePartners.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Airlines ({airlinePartners.length})
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {airlinePartners.map((partner) => (
                  <PartnerCard
                    key={partner.id}
                    partner={partner}
                    transferPaths={transferMap.get(partner.id)}
                    isTracked={trackedNames.has(partner.name)}
                    onQuickAdd={() => quickAdd(partner.name)}
                    ratioLabel={ratioLabel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Hotels */}
          {(categoryFilter === "all" || categoryFilter === "hotel") && hotelPartners.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Hotels ({hotelPartners.length})
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {hotelPartners.map((partner) => (
                  <PartnerCard
                    key={partner.id}
                    partner={partner}
                    transferPaths={transferMap.get(partner.id)}
                    isTracked={trackedNames.has(partner.name)}
                    onQuickAdd={() => quickAdd(partner.name)}
                    ratioLabel={ratioLabel}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredPartners.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-8">
              No programs match your filters.
            </p>
          )}
        </div>
      )}

      {/* ── TAB: My Cards ──────────────────────────────────────────────────── */}
      {activeTab === "cards" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Select the credit cards you hold. Cards with transfer access unlock partner programs in the &quot;All Programs&quot; tab.
          </p>

          {/* Group cards by issuer */}
          {Array.from(new Set(cardCatalog.map((c) => c.issuer))).map((issuer) => {
            const issuerCards = cardCatalog.filter((c) => c.issuer === issuer);
            return (
              <div key={issuer}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{issuer}</h4>
                <div className="space-y-1">
                  {issuerCards.map((card) => {
                    const held = heldCards.has(card.id);
                    const prog = programs.find((p) => p.id === card.program);
                    return (
                      <button
                        key={card.id}
                        onClick={() => toggleCard(card.id)}
                        className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                          held
                            ? "border-amber-500/40 bg-amber-500/5"
                            : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200">{card.name}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{prog?.name ?? card.program}</span>
                            {card.transferEnabled ? (
                              <span className="text-emerald-400">Transfer access</span>
                            ) : (
                              <span className="text-slate-600">Earns only (pair with transfer card)</span>
                            )}
                          </div>
                        </div>
                        <div className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition ${
                          held ? "border-amber-500 bg-amber-500" : "border-slate-600"
                        }`}>
                          {held && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {cardCatalog.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-8">
              Loading card catalog...
            </p>
          )}
        </div>
      )}

      {/* Live Award Availability */}
      <AwardAvailability />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Partner Card sub-component (used in "All Programs" tab)
// ---------------------------------------------------------------------------

function PartnerCard({
  partner,
  transferPaths,
  isTracked,
  onQuickAdd,
  ratioLabel,
}: {
  partner: TransferPartner;
  transferPaths?: Array<{ programId: string; programName: string; ratio: number }>;
  isTracked: boolean;
  onQuickAdd: () => void;
  ratioLabel: (r: number) => string;
}) {
  const hasTransferAccess = transferPaths && transferPaths.length > 0;

  return (
    <div
      className={`rounded-lg border p-3 transition ${
        hasTransferAccess
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">{partner.name}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="capitalize">{partner.kind}</span>
            {partner.family && (
              <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px]">{partner.family}</span>
            )}
            {isTracked && (
              <span className="text-amber-400">Tracked</span>
            )}
          </div>
        </div>
        {!isTracked && (
          <button
            onClick={onQuickAdd}
            className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 transition hover:border-amber-500 hover:text-amber-400"
            title="Track this program"
          >
            + Track
          </button>
        )}
      </div>

      {/* Transfer paths from user's cards */}
      {hasTransferAccess && (
        <div className="mt-2 space-y-1">
          {transferPaths.map((path) => (
            <div
              key={path.programId}
              className="flex items-center gap-2 text-xs"
            >
              <span className="text-emerald-400">
                {path.programName.split(" ")[0]}
              </span>
              <span className="text-slate-600">&rarr;</span>
              <span className="text-slate-400">{ratioLabel(path.ratio)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Award Availability from seats.aero
// ---------------------------------------------------------------------------

interface AwardDeal {
  id?: string;
  origin?: string;
  destination?: string;
  airline?: string;
  cabin?: string;
  miles?: number;
  program?: string;
  programName?: string;
  date?: string;
  [key: string]: unknown;
}

function AwardAvailability() {
  const [deals, setDeals] = useState<AwardDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/awards/availability?origin=MCO&limit=10");
        if (!res.ok) throw new Error("unavailable");
        const data = await res.json();
        if (!cancelled) {
          setDeals(data.deals ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Award availability unavailable");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) return null;
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-2">Live Award Availability</h4>
        <p className="text-xs text-slate-500 animate-pulse">Loading award seats from seats.aero...</p>
      </div>
    );
  }
  if (deals.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-200">Live Award Availability</h4>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">seats.aero</span>
      </div>
      <div className="space-y-2">
        {deals.slice(0, 8).map((deal, i) => (
          <div key={deal.id ?? i} className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/20 p-2.5">
            <div className="min-w-0">
              <p className="text-sm text-slate-200">
                {deal.origin ?? "MCO"} &rarr; {deal.destination ?? "---"}
              </p>
              <p className="text-xs text-slate-500">
                {deal.airline ?? "Unknown"} &middot; {deal.cabin ?? "Economy"}
                {deal.date && ` &middot; ${deal.date}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              {deal.miles != null && (
                <>
                  <span className="text-sm font-semibold text-emerald-400">{deal.miles.toLocaleString()}</span>
                  <span className="text-xs text-slate-500 block">{deal.programName ?? deal.program ?? "miles"}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
