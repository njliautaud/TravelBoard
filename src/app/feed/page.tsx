import { prisma } from "@/lib/prisma";
import { serializePublicSpot } from "@/lib/serialize";

// Public, read-only feed of individually-published spots. No auth — this is the
// shareable link. Always fresh.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "TravelBoard — Public feed",
  description: "Spots travelers have shared publicly.",
};

export default async function PublicFeedPage() {
  const rows = await prisma.location.findMany({
    where: { isPublic: true },
    include: { media: true, user: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const spots = rows.map(serializePublicSpot);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Public feed</h1>
          <p className="text-sm text-slate-400">
            Spots travelers have chosen to share. Read-only.
          </p>
        </header>

        {spots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-900/40 px-4 py-16 text-center text-sm text-slate-500">
            No public spots yet. When someone publishes a spot, it shows up here.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spots.map((s) => {
              const place = [s.city, s.region, s.countryName].filter(Boolean).join(", ");
              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/60"
                >
                  <div className="aspect-[4/3] w-full bg-slate-800/80">
                    {s.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.coverImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-600">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="truncate text-sm font-semibold">{s.activityName}</h2>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          s.status === "VISITED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {s.status === "VISITED" ? "Visited" : "Wishlist"}
                      </span>
                    </div>
                    {place && <p className="mt-0.5 truncate text-xs text-slate-400">{place}</p>}
                    <p className="mt-2 text-[11px] text-slate-500">by {s.author.username}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
