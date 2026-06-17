export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-amber-400 mb-4">404</h1>
        <p className="text-slate-400 mb-6">This page doesn&apos;t exist.</p>
        <a
          href="/"
          className="px-6 py-3 bg-amber-500 text-slate-950 font-semibold rounded-lg hover:bg-amber-400 transition"
        >
          Back to TravelBoard
        </a>
      </div>
    </div>
  );
}
