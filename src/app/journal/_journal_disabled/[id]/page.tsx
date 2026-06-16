import Link from "next/link";

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

export default function SharedJournalPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">Journal Entry</h1>
        <p className="text-slate-400">
          Shared journal entries are available when signed in.
        </p>
        <Link href="/" className="mt-6 inline-block px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition">
          ← Back to TravelBoard
        </Link>
      </div>
    </div>
  );
}
