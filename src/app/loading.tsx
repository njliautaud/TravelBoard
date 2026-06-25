export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-6">
        {/* Pulsing amber dot */}
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute h-14 w-14 animate-ping rounded-full bg-amber-500/20" />
          <div className="absolute h-10 w-10 animate-pulse rounded-full bg-amber-500/30" />
          <div className="relative h-5 w-5 rounded-full bg-amber-400 shadow-lg shadow-amber-500/40" />
        </div>

        {/* App name */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-amber-400">TravelBoard</h1>
          <p className="mt-1 text-xs text-slate-500">Loading your world...</p>
        </div>
      </div>
    </div>
  );
}
