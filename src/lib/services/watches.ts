/**
 * Watch & alert service — CRUD for price watches and alert checking logic.
 * Ported from Meridian's store.ts + alert-check.ts, adapted for TravelBoard's
 * Prisma-backed data layer.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WatchItem {
  id: string;
  userId: string;
  origin: string;
  destinationCode: string;
  targetPrice: number;
  currency: string;
  active: boolean;
  lastChecked: string | null;
  lastAlertedAt: string | null;
  createdAt: string;
  /** Best current price from fare cache (populated when listing) */
  currentBestPrice?: number | null;
}

export interface AlertItem {
  id: string;
  watchId: string;
  price: number;
  source: string | null;
  triggeredAt: string;
  /** Watch details joined in */
  origin?: string;
  destinationCode?: string;
  targetPrice?: number;
}

// ---------------------------------------------------------------------------
// Watch CRUD
// ---------------------------------------------------------------------------

export async function listWatches(userId: string): Promise<WatchItem[]> {
  const watches = await prisma.watch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // Enrich with current best prices from fare cache
  const enriched: WatchItem[] = [];
  for (const w of watches) {
    // Try matching by flyToCode (IATA code) first, fall back to destination (city name)
    const bestFare = await prisma.fareCache.findFirst({
      where: {
        origin: w.origin,
        OR: [
          { flyToCode: w.destinationCode },
          { destination: w.destinationCode },
        ],
      },
      orderBy: { price: "asc" },
      select: { price: true },
    });

    enriched.push({
      id: w.id,
      userId: w.userId,
      origin: w.origin,
      destinationCode: w.destinationCode,
      targetPrice: Number(w.targetPrice),
      currency: w.currency,
      active: w.active,
      lastChecked: w.lastChecked?.toISOString() ?? null,
      lastAlertedAt: w.lastAlertedAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
      currentBestPrice: bestFare ? Number(bestFare.price) : null,
    });
  }

  return enriched;
}

export async function createWatch(
  userId: string,
  data: {
    origin: string;
    destinationCode: string;
    targetPrice: number;
    currency?: string;
  },
): Promise<WatchItem> {
  const w = await prisma.watch.create({
    data: {
      userId,
      origin: data.origin.toUpperCase(),
      destinationCode: data.destinationCode.toUpperCase(),
      targetPrice: data.targetPrice,
      currency: data.currency ?? "USD",
    },
  });
  return {
    id: w.id,
    userId: w.userId,
    origin: w.origin,
    destinationCode: w.destinationCode,
    targetPrice: Number(w.targetPrice),
    currency: w.currency,
    active: w.active,
    lastChecked: null,
    lastAlertedAt: null,
    createdAt: w.createdAt.toISOString(),
  };
}

export async function updateWatch(
  watchId: string,
  userId: string,
  data: { targetPrice?: number; active?: boolean },
): Promise<WatchItem | null> {
  const existing = await prisma.watch.findFirst({
    where: { id: watchId, userId },
  });
  if (!existing) return null;

  const updateData: Prisma.WatchUpdateInput = {};
  if (data.targetPrice != null) updateData.targetPrice = data.targetPrice;
  if (data.active != null) updateData.active = data.active;

  const w = await prisma.watch.update({
    where: { id: watchId },
    data: updateData,
  });
  return {
    id: w.id,
    userId: w.userId,
    origin: w.origin,
    destinationCode: w.destinationCode,
    targetPrice: Number(w.targetPrice),
    currency: w.currency,
    active: w.active,
    lastChecked: w.lastChecked?.toISOString() ?? null,
    lastAlertedAt: w.lastAlertedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
  };
}

export async function deleteWatch(watchId: string, userId: string): Promise<boolean> {
  const existing = await prisma.watch.findFirst({
    where: { id: watchId, userId },
  });
  if (!existing) return false;
  await prisma.watch.delete({ where: { id: watchId } });
  return true;
}

// ---------------------------------------------------------------------------
// Alert checking — compare watches against fare cache
// ---------------------------------------------------------------------------

export async function checkWatchAlerts(userId: string): Promise<number> {
  const watches = await prisma.watch.findMany({
    where: { userId, active: true },
  });

  let alertCount = 0;
  const now = new Date();
  const dedupWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const w of watches) {
    // Find cheapest current fare for this route (try IATA code first, then city name)
    const bestFare = await prisma.fareCache.findFirst({
      where: {
        origin: w.origin,
        OR: [
          { flyToCode: w.destinationCode },
          { destination: w.destinationCode },
        ],
      },
      orderBy: { price: "asc" },
    });

    if (!bestFare || Number(bestFare.price) > Number(w.targetPrice)) continue;

    // Check dedup: don't alert again within 24h
    const recentAlert = await prisma.alertLog.findFirst({
      where: {
        watchId: w.id,
        triggeredAt: { gte: dedupWindow },
      },
    });
    if (recentAlert) continue;

    // Create alert
    await prisma.alertLog.create({
      data: {
        watchId: w.id,
        price: bestFare.price,
        source: bestFare.source,
      },
    });

    // Update watch last-alerted timestamp
    await prisma.watch.update({
      where: { id: w.id },
      data: { lastAlertedAt: now, lastChecked: now },
    });

    alertCount++;
  }

  return alertCount;
}

// ---------------------------------------------------------------------------
// Alert listing + acknowledgment
// ---------------------------------------------------------------------------

export async function listAlerts(
  userId: string,
  limit = 50,
): Promise<AlertItem[]> {
  const alerts = await prisma.alertLog.findMany({
    where: {
      watch: { userId },
    },
    include: {
      watch: {
        select: { origin: true, destinationCode: true, targetPrice: true },
      },
    },
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });

  return alerts.map((a) => ({
    id: a.id,
    watchId: a.watchId,
    price: Number(a.price),
    source: a.source,
    triggeredAt: a.triggeredAt.toISOString(),
    origin: a.watch.origin,
    destinationCode: a.watch.destinationCode,
    targetPrice: Number(a.watch.targetPrice),
  }));
}

export async function getUnacknowledgedAlertCount(userId: string): Promise<number> {
  // AlertLog doesn't have an acknowledgedAt field in current schema,
  // so we count alerts from the last 7 days as "unread"
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.alertLog.count({
    where: {
      watch: { userId },
      triggeredAt: { gte: since },
    },
  });
}

export async function acknowledgeAlert(
  alertId: string,
  userId: string,
): Promise<boolean> {
  // Verify the alert belongs to this user
  const alert = await prisma.alertLog.findFirst({
    where: {
      id: alertId,
      watch: { userId },
    },
  });
  if (!alert) return false;

  // For ack, we simply record this by updating the watch's lastChecked
  await prisma.watch.update({
    where: { id: alert.watchId },
    data: { lastChecked: new Date() },
  });
  return true;
}
