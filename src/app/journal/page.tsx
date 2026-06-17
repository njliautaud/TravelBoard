import Link from "next/link";

export default function JournalIndexPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-8">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-amber-400 mb-4">Travel Journal</h1>
        <p className="text-slate-400 mb-6">
          Your journal entries live inside the app. Sign in to view and create entries.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-amber-500 text-slate-950 font-semibold rounded-lg hover:bg-amber-400 transition"
        >
          Open TravelBoard
        </Link>
      </div>
    </div>
  );
}
