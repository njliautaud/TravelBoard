"use client";

import { useCallback, useEffect, useState } from "react";

interface TripLeg {
  id: string;
  origin: string;
  destination: string;
  departDate: string | null;
  returnDate: string | null;
  fareAmount: number | null;
  fareSource: string | null;
  notes: string | null;
  sortOrder: number;
}

interface TripPlan {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  currency: string;
  status: string;
  totalCost: number | null;
  legs: TripLeg[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-700 text-slate-300",
  PLANNED: "bg-blue-500/15 text-blue-400",
  BOOKED: "bg-emerald-500/15 text-emerald-400",
  COMPLETED: "bg-amber-500/15 text-amber-400",
  CANCELLED: "bg-red-500/15 text-red-400",
};

export default function TripPlanner() {
  const [plans, setPlans] = useState<TripPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TripPlan | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddLeg, setShowAddLeg] = useState(false);
  const [planForm, setPlanForm] = useState({ name: "", description: "", budget: "", startDate: "", endDate: "" });
  const [legForm, setLegForm] = useState({ origin: "", destination: "", departDate: "", fareAmount: "", notes: "" });

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/trips/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans ?? []);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  async function loadPlan(id: string) {
    try {
      const res = await fetch(`/api/trips/plans/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPlan(data.plan);
      }
    } catch { /* */ }
  }

  async function handleCreatePlan() {
    if (!planForm.name.trim()) return;
    try {
      const res = await fetch("/api/trips/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planForm.name,
          description: planForm.description || undefined,
          budget: planForm.budget ? parseFloat(planForm.budget) : undefined,
          startDate: planForm.startDate || undefined,
          endDate: planForm.endDate || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPlan(data.plan);
        setShowCreate(false);
        setPlanForm({ name: "", description: "", budget: "", startDate: "", endDate: "" });
        loadPlans();
      }
    } catch { /* */ }
  }

  async function handleAddLeg() {
    if (!selectedPlan || !legForm.origin.trim() || !legForm.destination.trim()) return;
    try {
      const res = await fetch(`/api/trips/plans/${selectedPlan.id}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: legForm.origin,
          destination: legForm.destination,
          departDate: legForm.departDate || undefined,
          fareAmount: legForm.fareAmount ? parseFloat(legForm.fareAmount) : undefined,
          notes: legForm.notes || undefined,
        }),
      });
      if (res.ok) {
        setShowAddLeg(false);
        setLegForm({ origin: "", destination: "", departDate: "", fareAmount: "", notes: "" });
        loadPlan(selectedPlan.id);
        loadPlans();
      }
    } catch { /* */ }
  }

  async function handleDeleteLeg(legId: string) {
    if (!selectedPlan) return;
    await fetch(`/api/trips/plans/${selectedPlan.id}/legs/${legId}`, { method: "DELETE" });
    loadPlan(selectedPlan.id);
    loadPlans();
  }

  async function handleUpdateStatus(status: string) {
    if (!selectedPlan) return;
    const res = await fetch(`/api/trips/plans/${selectedPlan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setSelectedPlan(data.plan);
      loadPlans();
    }
  }

  async function handleDeletePlan() {
    if (!selectedPlan) return;
    await fetch(`/api/trips/plans/${selectedPlan.id}`, { method: "DELETE" });
    setSelectedPlan(null);
    loadPlans();
  }

  // Plan detail view
  if (selectedPlan) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedPlan(null)}
          className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to plans
        </button>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-100">{selectedPlan.name}</h3>
            {selectedPlan.description && (
              <p className="text-sm text-slate-400">{selectedPlan.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[selectedPlan.status] ?? STATUS_COLORS.DRAFT}`}>
              {selectedPlan.status}
            </span>
            <button
              onClick={handleDeletePlan}
              className="rounded p-1 text-slate-500 transition hover:text-red-400"
              title="Delete plan"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status & Budget bar */}
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {selectedPlan.startDate && <span>Starts: {new Date(selectedPlan.startDate).toLocaleDateString()}</span>}
          {selectedPlan.endDate && <span>Ends: {new Date(selectedPlan.endDate).toLocaleDateString()}</span>}
          {selectedPlan.budget != null && (
            <span>
              Budget: <span className="text-slate-200">${selectedPlan.budget}</span>
              {selectedPlan.totalCost != null && (
                <span className={selectedPlan.totalCost > selectedPlan.budget ? " text-red-400" : " text-emerald-400"}>
                  {" "}(${selectedPlan.totalCost} spent)
                </span>
              )}
            </span>
          )}
          {selectedPlan.totalCost != null && selectedPlan.budget == null && (
            <span>Total cost: <span className="text-amber-400">${selectedPlan.totalCost}</span></span>
          )}
        </div>

        {/* Status buttons */}
        <div className="flex flex-wrap gap-1">
          {["DRAFT", "PLANNED", "BOOKED", "COMPLETED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => handleUpdateStatus(s)}
              disabled={selectedPlan.status === s}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                selectedPlan.status === s
                  ? STATUS_COLORS[s]
                  : "border border-slate-700 text-slate-500 hover:text-slate-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Legs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Legs</h4>
            <button
              onClick={() => setShowAddLeg(true)}
              className="text-xs text-amber-400 transition hover:text-amber-300"
            >
              + Add leg
            </button>
          </div>

          {selectedPlan.legs.length === 0 && !showAddLeg && (
            <p className="text-sm text-slate-500 py-4 text-center">No legs yet. Add your first destination.</p>
          )}

          {selectedPlan.legs.map((leg, i) => (
            <div key={leg.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-400">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-200">{leg.origin}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600 shrink-0">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-200">{leg.destination}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {leg.departDate ? new Date(leg.departDate).toLocaleDateString() : "No date set"}
                  {leg.notes && ` · ${leg.notes}`}
                </p>
              </div>
              {leg.fareAmount != null && (
                <span className="text-sm font-medium text-amber-400">${leg.fareAmount}</span>
              )}
              <button
                onClick={() => handleDeleteLeg(leg.id)}
                className="rounded p-1 text-slate-500 transition hover:text-red-400"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add Leg Form */}
          {showAddLeg && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={legForm.origin}
                  onChange={(e) => setLegForm((p) => ({ ...p, origin: e.target.value }))}
                  placeholder="From (MCO)"
                  maxLength={3}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
                <input
                  value={legForm.destination}
                  onChange={(e) => setLegForm((p) => ({ ...p, destination: e.target.value }))}
                  placeholder="To (NRT)"
                  maxLength={3}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
                <input
                  value={legForm.departDate}
                  onChange={(e) => setLegForm((p) => ({ ...p, departDate: e.target.value }))}
                  type="date"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                />
                <input
                  value={legForm.fareAmount}
                  onChange={(e) => setLegForm((p) => ({ ...p, fareAmount: e.target.value }))}
                  placeholder="Price"
                  type="number"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <input
                value={legForm.notes}
                onChange={(e) => setLegForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Notes (optional)"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddLeg}
                  disabled={!legForm.origin.trim() || !legForm.destination.trim()}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddLeg(false)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 transition hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Plans list view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Your Trip Plans</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400"
        >
          + New Plan
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">New Trip Plan</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={planForm.name}
              onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Trip name"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none sm:col-span-2"
            />
            <input
              value={planForm.description}
              onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description (optional)"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none sm:col-span-2"
            />
            <input
              value={planForm.budget}
              onChange={(e) => setPlanForm((p) => ({ ...p, budget: e.target.value }))}
              placeholder="Budget"
              type="number"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <input
              value={planForm.startDate}
              onChange={(e) => setPlanForm((p) => ({ ...p, startDate: e.target.value }))}
              type="date"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreatePlan}
              disabled={!planForm.name.trim()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plans List */}
      {plans.length === 0 && !showCreate ? (
        <p className="text-center text-sm text-slate-500 py-8">
          No trip plans yet. Create your first multi-leg trip itinerary.
        </p>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => loadPlan(plan.id)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-left transition hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{plan.name}</p>
                  <p className="text-xs text-slate-500">
                    {plan.legs.length} leg{plan.legs.length !== 1 ? "s" : ""}
                    {plan.totalCost != null && ` · $${plan.totalCost}`}
                    {plan.startDate && ` · ${new Date(plan.startDate).toLocaleDateString()}`}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[plan.status] ?? STATUS_COLORS.DRAFT}`}>
                  {plan.status}
                </span>
              </div>
              {plan.legs.length > 0 && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {plan.legs.map((l) => l.origin).join(" → ")} → {plan.legs[plan.legs.length - 1]?.destination}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
