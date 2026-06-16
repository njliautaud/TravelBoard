import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/savings?days=90
 * Aggregates savings from triggered price alerts for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(
    365,
    Math.max(1, Number(request.nextUrl.searchParams.get("days") ?? "90")),
  );
  const since = new Date(Date.now() - days * 86_400_000);

  // Get triggered alerts with their target prices and actual prices
  const alerts = await prisma.alertLog.findMany({
    where: {
      triggeredAt: { gte: since },
      watch: { userId: session.id },
    },
    include: {
      watch: {
        select: {
          destinationCode: true,
          targetPrice: true,
        },
      },
    },
    orderBy: { triggeredAt: "desc" },
  });

  // Compute savings per alert (target - actual)
  const rows = alerts.map((a) => ({
    code: a.watch.destinationCode,
    savings: Math.max(0, Number(a.watch.targetPrice) - Number(a.price)),
    triggeredAt: a.triggeredAt.toISOString(),
  }));

  const totalSavings = rows.reduce((sum, r) => sum + r.savings, 0);
  const alertsTriggered = rows.length;
  const avgSavingsPerAlert = alertsTriggered > 0 ? Math.round(totalSavings / alertsTriggered) : 0;

  // Best single deal
  const bestRow = rows.reduce<(typeof rows)[0] | null>(
    (best, r) => (!best || r.savings > best.savings ? r : best),
    null,
  );
  const bestDeal = bestRow
    ? { code: bestRow.code, savings: bestRow.savings, date: bestRow.triggeredAt }
    : null;

  // By month
  const byMonth = new Map<string, { savings: number; alerts: number }>();
  for (const r of rows) {
    const month = r.triggeredAt.slice(0, 7);
    const e = byMonth.get(month) ?? { savings: 0, alerts: 0 };
    e.savings += r.savings;
    e.alerts++;
    byMonth.set(month, e);
  }
  const savingsByMonth = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v }));

  // Top destinations
  const byDest = new Map<string, { totalSavings: number; alerts: number }>();
  for (const r of rows) {
    const e = byDest.get(r.code) ?? { totalSavings: 0, alerts: 0 };
    e.totalSavings += r.savings;
    e.alerts++;
    byDest.set(r.code, e);
  }
  const topDestinations = [...byDest.entries()]
    .sort((a, b) => b[1].totalSavings - a[1].totalSavings)
    .slice(0, 10)
    .map(([code, v]) => ({ code, ...v }));

  // Active watches count
  const watchedRoutes = await prisma.watch.count({
    where: { userId: session.id, active: true },
  });

  return NextResponse.json({
    totalSavings,
    alertsTriggered,
    avgSavingsPerAlert,
    bestDeal,
    savingsByMonth,
    topDestinations,
    watchedRoutes,
  });
}
