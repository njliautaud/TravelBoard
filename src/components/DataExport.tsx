"use client";

/**
 * Phase 3 — Data Export dialog.
 * Lets user download all their TravelBoard data as JSON or CSV.
 */

import { useState } from "react";

export default function DataExport({ onClose }: { onClose: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const handleExport = async (format: "json" | "csv") => {
    setExporting(true);
    setDone(null);
    try {
      const res = await fetch(`/api/export/${format}`);
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `travelboard-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDone(format.toUpperCase());
    } catch (err) {
      setDone(`Error: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Export Your Data</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-slate-400">
          Download all your TravelBoard data: saved trips, watches, trip plans,
          journal entries, and preferences.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
          >
            {exporting ? "Exporting..." : "Download JSON"}
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
          >
            {exporting ? "Exporting..." : "Download CSV"}
          </button>
        </div>

        {done && (
          <div
            className={`mt-4 rounded-lg p-3 text-center text-sm ${
              done.startsWith("Error")
                ? "bg-red-950/40 text-red-400"
                : "bg-emerald-950/40 text-emerald-400"
            }`}
          >
            {done.startsWith("Error") ? done : `${done} file downloaded successfully.`}
          </div>
        )}
      </div>
    </div>
  );
}
