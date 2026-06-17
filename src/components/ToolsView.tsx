"use client";

import { useEffect, useState } from "react";
import PointsCalculator from "./PointsCalculator";
import PointsOptimizer from "./PointsOptimizer";
import CardManager from "./CardManager";
import TripPlanner from "./TripPlanner";
import FarePrediction from "./FarePrediction";
import LoyaltyTracker from "./LoyaltyTracker";
import FlightTracker from "./FlightTracker";
import MemoryMap from "./MemoryMap";
import SavingsDashboard from "./SavingsDashboard";
import PackingSuggestions from "./PackingSuggestions";
// demoData import removed — all data comes from APIs

type ToolId = "hub" | "calculator" | "optimizer" | "cards" | "trips" | "prediction" | "loyalty" | "flight-tracker" | "memory-map" | "savings" | "packing";

interface ToolCard {
  id: ToolId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TOOLS: ToolCard[] = [
  {
    id: "calculator",
    label: "Points Calculator",
    description: "See how many points a flight costs across programs",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="10" y2="10" />
        <line x1="12" y1="10" x2="14" y2="10" />
        <line x1="8" y1="14" x2="10" y2="14" />
        <line x1="12" y1="14" x2="14" y2="14" />
        <line x1="8" y1="18" x2="10" y2="18" />
        <line x1="12" y1="18" x2="16" y2="18" />
      </svg>
    ),
  },
  {
    id: "optimizer",
    label: "Transfer Optimizer",
    description: "Find the best transfer path for your points",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
      </svg>
    ),
  },
  {
    id: "cards",
    label: "Card Manager",
    description: "Manage your credit cards and point balances",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    id: "loyalty",
    label: "Loyalty Tracker",
    description: "Track miles and points across loyalty programs",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: "trips",
    label: "Trip Planner",
    description: "Build multi-leg trip itineraries with budget tracking",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    id: "prediction",
    label: "Fare Prediction",
    description: "Buy now or wait? Price trend analysis for routes",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "flight-tracker",
    label: "Flight Tracker",
    description: "Track any flight in real-time by flight number",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
  },
  {
    id: "memory-map",
    label: "Memory Map",
    description: "View your travel history with routes and stats",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: "savings",
    label: "Savings Dashboard",
    description: "See how much you have saved on flights over time",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: "packing",
    label: "Packing List",
    description: "Weather-aware packing suggestions for your trip",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
];

function PackingWrapper() {
  const [dest, setDest] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [started, setStarted] = useState(false);

  async function handleSearch() {
    if (!dest.trim()) return;
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(dest)}`);
      const data = await res.json();
      if (data.lat && data.lon) {
        setLat(data.lat);
        setLon(data.lon);
        setStarted(true);
      }
    } catch { setStarted(true); setLat(40.7); setLon(-74.0); }
  }

  if (started && lat != null && lon != null) {
    return <PackingSuggestions lat={lat} lon={lon} destination={dest || "Your Destination"} departDate={date} />;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-center py-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">Where are you going?</h3>
        <p className="text-sm text-slate-400">We&apos;ll check the weather and suggest what to pack.</p>
      </div>
      <input
        type="text"
        placeholder="City or destination..."
        value={dest}
        onChange={e => setDest(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSearch()}
        className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
      />
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 focus:border-amber-500/60 focus:outline-none"
      />
      <button
        onClick={handleSearch}
        disabled={!dest.trim()}
        className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-400 disabled:opacity-50"
      >
        Get packing suggestions
      </button>
    </div>
  );
}

function QuickStatsBanner() {
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [programCount, setProgramCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      let loyaltyPoints = 0;
      let loyaltyCount = 0;
      let cardPoints = 0;

      try {
        const res = await fetch("/api/loyalty");
        if (res.ok) {
          const data = await res.json();
          const items = data.balances ?? [];
          if (items.length > 0) {
            loyaltyPoints = items.reduce((s: number, b: { balance: number }) => s + b.balance, 0);
            loyaltyCount = items.length;
          }
        }
      } catch { /* fallback below */ }

      try {
        const res = await fetch("/api/points/cards");
        if (res.ok) {
          const data = await res.json();
          const items = data.cards ?? [];
          if (items.length > 0) {
            cardPoints = items.reduce((s: number, c: { pointsBalance: number }) => s + c.pointsBalance, 0);
          }
        }
      } catch { /* API unavailable */ }

      setTotalPoints(loyaltyPoints + cardPoints);
      setProgramCount(loyaltyCount);
    })();
  }, []);

  if (totalPoints === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-slate-900/80 p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400">Total Points & Miles</span>
          <p className="text-2xl font-bold text-amber-400">{totalPoints.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400">Across</span>
          <p className="text-lg font-semibold text-slate-200">{programCount} programs</p>
        </div>
      </div>
    </div>
  );
}

export default function ToolsView() {
  const [activeTool, setActiveTool] = useState<ToolId>("hub");

  function renderTool() {
    switch (activeTool) {
      case "calculator": return <PointsCalculator />;
      case "optimizer": return <PointsOptimizer />;
      case "cards": return <CardManager />;
      case "loyalty": return <LoyaltyTracker />;
      case "trips": return <TripPlanner />;
      case "prediction": return <FarePrediction />;
      case "flight-tracker": return <FlightTracker />;
      case "memory-map": return <MemoryMap />;
      case "savings": return <SavingsDashboard />;
      case "packing": return <PackingWrapper />;
      default: return null;
    }
  }

  const activeLabel = TOOLS.find((t) => t.id === activeTool)?.label;

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          {activeTool !== "hub" && (
            <button
              onClick={() => setActiveTool("hub")}
              className="rounded p-1 text-slate-500 transition hover:text-slate-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {activeTool === "hub" ? "Tools" : activeLabel}
            </h2>
            <p className="text-xs text-slate-500">
              {activeTool === "hub"
                ? "Points, trips, predictions, and more"
                : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTool === "hub" ? (
          <div className="mx-auto max-w-lg">
            <QuickStatsBanner />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className="group flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-amber-500/30 hover:bg-slate-900/70"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/80 text-amber-400 transition group-hover:border-amber-500/30">
                    {tool.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200">{tool.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{tool.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : activeTool === "memory-map" ? (
          <div className="h-full">
            {renderTool()}
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            {renderTool()}
          </div>
        )}
      </div>
    </div>
  );
}
