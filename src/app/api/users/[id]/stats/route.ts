import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/users/[id]/stats — aggregated board stats for a profile preview card.
 * Visible for yourself or an accepted friend. Aggregation runs as indexed
 * count/groupBy queries (Location has an index on userId) so it stays cheap.
 */
export async function GET(_req: Request, { params }: Params) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: targetId } = await params;

  if (targetId !== me.id) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: me.id, addresseeId: targetId },
          { requesterId: targetId, addresseeId: me.id },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      return NextResponse.json({ error: "Not friends with this user." }, { status: 403 });
    }
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, username: true },
  });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const [byStatus, countries] = await Promise.all([
    prisma.location.groupBy({
      by: ["status"],
      where: { userId: targetId },
      _count: { _all: true },
    }),
    prisma.location.findMany({
      where: { userId: targetId },
      select: { countryCode: true },
      distinct: ["countryCode"],
    }),
  ]);

  const visited = byStatus.find((g) => g.status === "VISITED")?._count._all ?? 0;
  const toVisit = byStatus.find((g) => g.status === "TO_VISIT")?._count._all ?? 0;

  return NextResponse.json({
    user: target,
    stats: {
      total: visited + toVisit,
      visited,
      toVisit,
      countries: countries.length,
    },
  });
}
