/**
 * Trip planner service — ported from Meridian's trip-planner.ts.
 *
 * Uses Prisma (PostgreSQL) with TripPlan + TripPlanLeg models. Supports
 * create/update/delete plans, add/remove/reorder legs, budget tracking,
 * and status management (draft -> planned -> booked -> completed).
 */

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { TripPlanStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TripPlanLegData {
  id: string;
  origin: string;
  destination: string;
  departDate: string | null;
  returnDate: string | null;
  fareAmount: number | null;
  fareSource: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface TripPlanData {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  currency: string;
  status: TripPlanStatus;
  totalCost: number | null;
  legs: TripPlanLegData[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeTotalCost(legs: Array<{ fareAmount: Decimal | null }>): number | null {
  let total = 0;
  let allPriced = true;
  for (const leg of legs) {
    if (leg.fareAmount != null) {
      total += Number(leg.fareAmount);
    } else {
      allPriced = false;
    }
  }
  return allPriced && legs.length > 0 ? Math.round(total * 100) / 100 : null;
}

function serializePlan(plan: {
  id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  budget: Decimal | null;
  currency: string;
  status: TripPlanStatus;
  createdAt: Date;
  updatedAt: Date;
  legs: Array<{
    id: string;
    origin: string;
    destination: string;
    departDate: Date | null;
    returnDate: Date | null;
    fareAmount: Decimal | null;
    fareSource: string | null;
    notes: string | null;
    sortOrder: number;
  }>;
}): TripPlanData {
  const legs = plan.legs
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({
      id: l.id,
      origin: l.origin,
      destination: l.destination,
      departDate: l.departDate?.toISOString() ?? null,
      returnDate: l.returnDate?.toISOString() ?? null,
      fareAmount: l.fareAmount ? Number(l.fareAmount) : null,
      fareSource: l.fareSource,
      notes: l.notes,
      sortOrder: l.sortOrder,
    }));

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    startDate: plan.startDate?.toISOString() ?? null,
    endDate: plan.endDate?.toISOString() ?? null,
    budget: plan.budget ? Number(plan.budget) : null,
    currency: plan.currency,
    status: plan.status,
    totalCost: computeTotalCost(plan.legs),
    legs,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

const planInclude = { legs: { orderBy: { sortOrder: "asc" as const } } };

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listTripPlans(userId: string): Promise<TripPlanData[]> {
  const plans = await prisma.tripPlan.findMany({
    where: { userId },
    include: planInclude,
    orderBy: { updatedAt: "desc" },
  });
  return plans.map(serializePlan);
}

export async function getTripPlan(id: string, userId: string): Promise<TripPlanData | null> {
  const plan = await prisma.tripPlan.findFirst({
    where: { id, userId },
    include: planInclude,
  });
  return plan ? serializePlan(plan) : null;
}

export async function createTripPlan(
  userId: string,
  data: {
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    budget?: number;
    currency?: string;
    status?: TripPlanStatus;
  },
): Promise<TripPlanData> {
  const plan = await prisma.tripPlan.create({
    data: {
      userId,
      name: data.name,
      description: data.description ?? null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      budget: data.budget != null ? new Decimal(data.budget) : null,
      currency: data.currency ?? "USD",
      status: data.status ?? "DRAFT",
    },
    include: planInclude,
  });
  return serializePlan(plan);
}

export async function updateTripPlan(
  id: string,
  userId: string,
  data: {
    name?: string;
    description?: string;
    startDate?: string | null;
    endDate?: string | null;
    budget?: number | null;
    currency?: string;
    status?: TripPlanStatus;
  },
): Promise<TripPlanData | null> {
  const existing = await prisma.tripPlan.findFirst({ where: { id, userId } });
  if (!existing) return null;
  const plan = await prisma.tripPlan.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.budget !== undefined && { budget: data.budget != null ? new Decimal(data.budget) : null }),
      ...(data.currency != null && { currency: data.currency }),
      ...(data.status != null && { status: data.status }),
    },
    include: planInclude,
  });
  return serializePlan(plan);
}

export async function deleteTripPlan(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.tripPlan.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.tripPlan.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------------------
// Leg CRUD
// ---------------------------------------------------------------------------

export async function listLegs(planId: string, userId: string): Promise<TripPlanLegData[] | null> {
  const plan = await prisma.tripPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) return null;
  const legs = await prisma.tripPlanLeg.findMany({
    where: { tripPlanId: planId },
    orderBy: { sortOrder: "asc" },
  });
  return legs.map((l) => ({
    id: l.id,
    origin: l.origin,
    destination: l.destination,
    departDate: l.departDate?.toISOString() ?? null,
    returnDate: l.returnDate?.toISOString() ?? null,
    fareAmount: l.fareAmount ? Number(l.fareAmount) : null,
    fareSource: l.fareSource,
    notes: l.notes,
    sortOrder: l.sortOrder,
  }));
}

export async function addLeg(
  planId: string,
  userId: string,
  data: {
    origin: string;
    destination: string;
    departDate?: string;
    returnDate?: string;
    fareAmount?: number;
    fareSource?: string;
    notes?: string;
  },
): Promise<TripPlanLegData | null> {
  const plan = await prisma.tripPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) return null;

  // Get next sort order
  const maxLeg = await prisma.tripPlanLeg.findFirst({
    where: { tripPlanId: planId },
    orderBy: { sortOrder: "desc" },
  });
  const nextOrder = (maxLeg?.sortOrder ?? -1) + 1;

  const leg = await prisma.tripPlanLeg.create({
    data: {
      tripPlanId: planId,
      origin: data.origin.toUpperCase(),
      destination: data.destination.toUpperCase(),
      departDate: data.departDate ? new Date(data.departDate) : null,
      returnDate: data.returnDate ? new Date(data.returnDate) : null,
      fareAmount: data.fareAmount != null ? new Decimal(data.fareAmount) : null,
      fareSource: data.fareSource ?? null,
      notes: data.notes ?? null,
      sortOrder: nextOrder,
    },
  });

  // Touch plan updatedAt
  await prisma.tripPlan.update({ where: { id: planId }, data: {} });

  return {
    id: leg.id,
    origin: leg.origin,
    destination: leg.destination,
    departDate: leg.departDate?.toISOString() ?? null,
    returnDate: leg.returnDate?.toISOString() ?? null,
    fareAmount: leg.fareAmount ? Number(leg.fareAmount) : null,
    fareSource: leg.fareSource,
    notes: leg.notes,
    sortOrder: leg.sortOrder,
  };
}

export async function updateLeg(
  legId: string,
  planId: string,
  userId: string,
  data: {
    origin?: string;
    destination?: string;
    departDate?: string | null;
    returnDate?: string | null;
    fareAmount?: number | null;
    fareSource?: string | null;
    notes?: string | null;
    sortOrder?: number;
  },
): Promise<TripPlanLegData | null> {
  const plan = await prisma.tripPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) return null;
  const existing = await prisma.tripPlanLeg.findFirst({ where: { id: legId, tripPlanId: planId } });
  if (!existing) return null;

  const leg = await prisma.tripPlanLeg.update({
    where: { id: legId },
    data: {
      ...(data.origin != null && { origin: data.origin.toUpperCase() }),
      ...(data.destination != null && { destination: data.destination.toUpperCase() }),
      ...(data.departDate !== undefined && { departDate: data.departDate ? new Date(data.departDate) : null }),
      ...(data.returnDate !== undefined && { returnDate: data.returnDate ? new Date(data.returnDate) : null }),
      ...(data.fareAmount !== undefined && { fareAmount: data.fareAmount != null ? new Decimal(data.fareAmount) : null }),
      ...(data.fareSource !== undefined && { fareSource: data.fareSource ?? null }),
      ...(data.notes !== undefined && { notes: data.notes ?? null }),
      ...(data.sortOrder != null && { sortOrder: data.sortOrder }),
    },
  });

  await prisma.tripPlan.update({ where: { id: planId }, data: {} });

  return {
    id: leg.id,
    origin: leg.origin,
    destination: leg.destination,
    departDate: leg.departDate?.toISOString() ?? null,
    returnDate: leg.returnDate?.toISOString() ?? null,
    fareAmount: leg.fareAmount ? Number(leg.fareAmount) : null,
    fareSource: leg.fareSource,
    notes: leg.notes,
    sortOrder: leg.sortOrder,
  };
}

export async function deleteLeg(legId: string, planId: string, userId: string): Promise<boolean> {
  const plan = await prisma.tripPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) return false;
  const existing = await prisma.tripPlanLeg.findFirst({ where: { id: legId, tripPlanId: planId } });
  if (!existing) return false;
  await prisma.tripPlanLeg.delete({ where: { id: legId } });
  await prisma.tripPlan.update({ where: { id: planId }, data: {} });
  return true;
}
