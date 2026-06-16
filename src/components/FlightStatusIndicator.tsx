"use client";

/**
 * Phase 4 — Flight Status Indicator.
 * Visual stop indicators: nonstop/1-stop/2-stop with dot diagram,
 * approximate flight duration, highlight for nonstop flights.
 */

interface FlightStatusProps {
  transfers: number | null | undefined;
  durationMin: number | null | undefined;
  compact?: boolean;
}

function formatDuration(totalMin: number, roundTrip = false): string {
  const min = roundTrip ? Math.round(totalMin / 2) : totalMin;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

function StopDots({ stops }: { stops: number }) {
  const midDots = Math.min(stops, 3);
  return (
    <span className="inline-flex items-center gap-0.5">
      {/* Origin dot */}
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      {Array.from({ length: midDots }, (_, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          <span className="h-px w-3 bg-slate-600" />
          <span className="h-1.5 w-1.5 rounded-full border border-slate-500 bg-slate-800" />
        </span>
      ))}
      {/* Final line + dest dot */}
      <span className="h-px w-3 bg-slate-600" />
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  );
}

export default function FlightStatusIndicator({ transfers, durationMin, compact = false }: FlightStatusProps) {
  const stops = typeof transfers === "number" ? transfers : null;
  const dur = typeof durationMin === "number" && durationMin > 0 ? durationMin : null;

  if (stops === null && dur === null) return null;

  const stopLabel = stops === 0 ? "Nonstop" : stops === 1 ? "1 stop" : stops != null ? `${stops} stops` : null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        {stops != null && (
          <>
            <StopDots stops={stops} />
            <span
              className={`font-medium ${
                stops === 0 ? "text-emerald-400" : stops === 1 ? "text-amber-400" : "text-slate-400"
              }`}
            >
              {stopLabel}
            </span>
          </>
        )}
        {dur != null && (
          <span
            className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-400"
            title={`Approx. ${formatDuration(dur, true)} each way (RT total: ${formatDuration(dur)})`}
          >
            ~{formatDuration(dur, true)}
          </span>
        )}
      </span>
    );
  }

  // Full version
  return (
    <div className="flex items-center gap-3">
      {stops != null && (
        <div className="flex items-center gap-2">
          <StopDots stops={stops} />
          <span
            className={`text-xs font-medium ${
              stops === 0 ? "text-emerald-400" : stops === 1 ? "text-amber-400" : "text-slate-400"
            }`}
          >
            {stopLabel}
          </span>
        </div>
      )}
      {dur != null && (
        <span className="text-xs tabular-nums text-slate-500">
          ~{formatDuration(dur, true)} each way
        </span>
      )}
    </div>
  );
}
