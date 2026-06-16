"use client";

/**
 * PriceHistoryChart — lightweight SVG sparkline/line chart showing price over
 * time for a route. No external chart library needed.
 */

interface PricePoint {
  date: string;
  price: number;
}

interface PriceHistoryChartProps {
  points: PricePoint[];
  /** Chart width (default 320) */
  width?: number;
  /** Chart height (default 80) */
  height?: number;
  /** Show axis labels (default true) */
  showLabels?: boolean;
}

export default function PriceHistoryChart({
  points,
  width = 320,
  height = 80,
  showLabels = true,
}: PriceHistoryChartProps) {
  if (points.length < 2) {
    return (
      <div className="text-xs text-slate-500 italic py-2">
        Not enough price data yet
      </div>
    );
  }

  const PAD_X = showLabels ? 40 : 6;
  const PAD_Y = 10;
  const W = width;
  const H = height;

  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const range = Math.max(1, hi - lo);

  const x = (i: number) =>
    PAD_X + (i / (points.length - 1)) * (W - PAD_X - 6);
  const y = (p: number) =>
    PAD_Y + (1 - (p - lo) / range) * (H - PAD_Y * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`)
    .join(" ");

  // Area fill under the line
  const areaD = `${pathD} L${x(points.length - 1).toFixed(1)},${(H - PAD_Y).toFixed(1)} L${PAD_X.toFixed(1)},${(H - PAD_Y).toFixed(1)} Z`;

  const minIdx = prices.indexOf(lo);
  const fmtPrice = (n: number) => `$${Math.round(n)}`;
  const fmtDate = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  };

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Price history: ${fmtPrice(lo)} to ${fmtPrice(hi)} over ${points.length} days`}
      >
        {/* Area fill */}
        <path d={areaD} fill="url(#priceGrad)" opacity={0.3} />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth={1.5} />

        {/* Min price marker */}
        <circle
          cx={x(minIdx)}
          cy={y(lo)}
          r={3}
          fill="#10b981"
          stroke="#0f172a"
          strokeWidth={1}
        />

        {/* Min price label */}
        <text
          x={Math.min(W - 30, Math.max(PAD_X + 5, x(minIdx)))}
          y={Math.max(12, y(lo) - 6)}
          className="fill-emerald-400"
          fontSize={9}
          textAnchor="middle"
          fontWeight="bold"
        >
          {fmtPrice(lo)}
        </text>

        {/* Axis labels */}
        {showLabels && (
          <>
            <text x={2} y={PAD_Y + 3} fontSize={8} className="fill-slate-500">
              {fmtPrice(hi)}
            </text>
            <text x={2} y={H - PAD_Y + 3} fontSize={8} className="fill-slate-500">
              {fmtPrice(lo)}
            </text>
            <text x={PAD_X} y={H - 1} fontSize={7} className="fill-slate-600">
              {fmtDate(points[0]!.date)}
            </text>
            <text
              x={W - 6}
              y={H - 1}
              fontSize={7}
              className="fill-slate-600"
              textAnchor="end"
            >
              {fmtDate(points[points.length - 1]!.date)}
            </text>
          </>
        )}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
