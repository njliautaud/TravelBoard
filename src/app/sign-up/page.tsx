import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <div className="w-full max-w-md px-4 text-center">
        <h1 className="text-2xl font-bold text-amber-400">TravelBoard</h1>
        <p className="mt-1 text-sm text-slate-400">Sign up coming soon</p>
        <Link href="/" className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition">
          ← Back to Map
        </Link>
      </div>
    </div>
  );
}
