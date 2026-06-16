"use client";

import { Component, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Error boundaries for graceful degradation.
// Wraps major UI sections so a crash in one (map, calendar, compare, etc.)
// doesn't take down the entire app.
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
  onError?: (error: Error, componentStack: string) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}]`, error, errorInfo);
    this.props.onError?.(error, errorInfo.componentStack ?? "");
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="mx-3 my-3 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 text-lg font-bold text-red-400">
            !
          </div>
          <div className="mb-1.5 text-sm font-semibold text-red-400">
            {this.props.name ? `${this.props.name} unavailable` : "Something went wrong"}
          </div>
          <div className="mb-4 text-xs leading-relaxed text-slate-400">
            This section encountered an error. The rest of the app still works normally.
          </div>
          <button
            onClick={this.handleRetry}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Skeleton loaders for data-fetching components
// ---------------------------------------------------------------------------

/** Pulsing skeleton block. */
export function SkeletonBlock({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gradient-to-r from-slate-800/40 via-slate-700/30 to-slate-800/40 ${className}`}
      style={{ width: width ?? "100%", height: height ?? "20px" }}
    />
  );
}

/** Skeleton for a deal card. */
export function DealCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-700/40 p-4 mb-2">
      <div className="flex justify-between mb-3">
        <SkeletonBlock width="120px" height="20px" />
        <SkeletonBlock width="60px" height="24px" />
      </div>
      <SkeletonBlock width="80%" height="14px" />
      <div className="mt-2">
        <SkeletonBlock width="60%" height="14px" />
      </div>
    </div>
  );
}

/** Skeleton for a list of deal cards. */
export function DealListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <DealCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for the map area. */
export function MapSkeleton() {
  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-xl">
      <SkeletonBlock width="100%" height="100%" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-slate-500">
        Loading map...
      </div>
    </div>
  );
}

/** Skeleton for calendar grid. */
export function CalendarSkeleton() {
  return (
    <div className="p-4">
      <SkeletonBlock width="200px" height="24px" />
      <div className="mt-4 grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => (
          <SkeletonBlock key={i} height="40px" className="rounded-md" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton for comparison table. */
export function CompareSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="rounded-xl border border-slate-700/40 p-4">
          <SkeletonBlock width="100px" height="22px" />
          <div className="mt-3"><SkeletonBlock width="80%" height="16px" /></div>
          <div className="mt-2"><SkeletonBlock width="60%" height="16px" /></div>
          <div className="mt-2"><SkeletonBlock width="70%" height="16px" /></div>
          <div className="mt-3"><SkeletonBlock width="80px" height="32px" /></div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for chart area. */
export function ChartSkeleton({ height = "200px" }: { height?: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ height }}>
      <SkeletonBlock width="100%" height="100%" />
    </div>
  );
}
