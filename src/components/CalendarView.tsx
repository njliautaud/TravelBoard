"use client";

/**
 * Calendar view: shows deals on a calendar where each day shows
 * the cheapest available fare. Color gradient from green (cheapest) to red
 * (most expensive). Click a day to see deals for that date.
 */

import { useEffect, useMemo, useState } from "react";

interface CalendarDay {
  date: string;
  price: number;
  deals: number;
  destination: string | null;
  source: string;
}

interface CalendarData {
  origin: string;
  dest: string | null;
  days: CalendarDay[];
  count: number;
  priceRange: { min: number; max: number };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Interpolate between green (cheap) and red (expensive). Returns CSS color. */
function priceColor(price: number, min: number, max: number): string {
  if (max === min) return "hsl(142, 76%, 36%)";
  const ratio = (price - min) / (max - min);
  const hue = 142 - ratio * 142;
  const sat = 60 + ratio * 15;
  const light = 40 + (1 - Math.abs(ratio - 0.5)) * 12;
  return `hsl(${Math.round(hue)}, ${Math.round(sat)}%, ${Math.round(light)}%)`;
}

export function CalendarView({
  origin,
  dest,
  onDayClick,
  onClose,
}: {
  origin: string;
  dest?: string;
  onDayClick?: (date: string, price: number) => void;
  onClose?: () => void;
}) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  });

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ origin });
    if (dest) q.set("dest", dest);
    q.set("months", "6");
    fetch(`/api/search/calendar?${q.toString()}`)
      .then((r) => r.json())
      .then((d) => setData(d as CalendarData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [origin, dest]);

  const dayIndex = useMemo(() => {
    if (!data) return new Map<string, CalendarDay>();
    return new Map(data.days.map((d) => [d.date, d]));
  }, [data]);

  const currentYear = Math.floor(selectedMonth / 12);
  const currentMonth = selectedMonth % 12;

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(Date.UTC(currentYear, currentMonth, 1));
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    const startDow = firstDay.getUTCDay();

    const grid: Array<{ day: number; date: string; data: CalendarDay | null } | null> = [];
    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      grid.push({ day: d, date: dateStr, data: dayIndex.get(dateStr) ?? null });
    }
    return grid;
  }, [currentYear, currentMonth, dayIndex]);

  const minPrice = data?.priceRange.min ?? 0;
  const maxPrice = data?.priceRange.max ?? 1;

  const now = new Date();
  const nowMonth = now.getFullYear() * 12 + now.getMonth();
  const canPrev = selectedMonth > nowMonth;
  const canNext = selectedMonth < nowMonth + 6;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[min(520px,92vw)] max-h-[85vh] overflow-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <h3 className="text-base font-bold text-slate-100 truncate">
            Fare Calendar
            {dest ? ` -- ${origin} to ${dest}` : ` from ${origin}`}
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Loading calendar data...</div>
        ) : !data || data.days.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No fare data available for this route yet. The calendar fills in as we observe prices.
          </div>
        ) : (
          <>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => canPrev && setSelectedMonth((m) => m - 1)}
                disabled={!canPrev}
                className={`rounded-lg border border-slate-700 px-4 py-2 text-sm transition ${
                  canPrev ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 cursor-default"
                }`}
              >
                Prev
              </button>
              <span className="text-sm font-semibold text-slate-200">
                {MONTHS[currentMonth]} {currentYear}
              </span>
              <button
                onClick={() => canNext && setSelectedMonth((m) => m + 1)}
                disabled={!canNext}
                className={`rounded-lg border border-slate-700 px-4 py-2 text-sm transition ${
                  canNext ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 cursor-default"
                }`}
              >
                Next
              </button>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5 mb-4">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className="py-1 text-center text-[10px] font-semibold text-slate-500">
                  {d}
                </div>
              ))}

              {calendarGrid.map((cell, i) =>
                cell === null ? (
                  <div key={`empty-${i}`} />
                ) : (
                  <button
                    key={cell.date}
                    onClick={() => cell.data && onDayClick?.(cell.date, cell.data.price)}
                    disabled={!cell.data}
                    className={`relative min-h-[48px] rounded-md text-center transition ${
                      cell.data
                        ? "cursor-pointer hover:ring-1 hover:ring-amber-500/40"
                        : "cursor-default"
                    }`}
                    style={{
                      background: cell.data
                        ? priceColor(cell.data.price, minPrice, maxPrice) + "22"
                        : "transparent",
                    }}
                    title={
                      cell.data
                        ? `$${cell.data.price} -- ${cell.data.deals} deal${cell.data.deals !== 1 ? "s" : ""}`
                        : "No data"
                    }
                  >
                    <div className="text-[11px] text-slate-400">{cell.day}</div>
                    {cell.data && (
                      <div
                        className="text-[10px] font-bold mt-0.5"
                        style={{ color: priceColor(cell.data.price, minPrice, maxPrice) }}
                      >
                        ${cell.data.price}
                      </div>
                    )}
                  </button>
                ),
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span>Cheapest</span>
              <div
                className="h-2 flex-1 rounded-full"
                style={{
                  background: "linear-gradient(to right, hsl(142,60%,40%), hsl(48,65%,48%), hsl(0,75%,45%))",
                }}
              />
              <span>Most expensive</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 text-center">
              ${minPrice} -- ${maxPrice} | {data.count} dates with fare data | click a day for details
            </div>
          </>
        )}
      </div>
    </div>
  );
}
