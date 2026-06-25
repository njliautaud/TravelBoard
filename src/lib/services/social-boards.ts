/**
 * Social boards service — shared deal boards with voting and comments.
 *
 * Adapted from Meridian's social-boards.ts to use Prisma/PostgreSQL.
 * Supports board CRUD, deal posting, voting, and commenting.
 */

import { prisma } from "@/lib/prisma";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardData {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  creatorId: string;
  createdAt: string;
  dealCount: number;
  deals: DealData[];
}

export interface DealData {
  id: string;
  boardId: string;
  userId: string;
  origin: string;
  destination: string;
  price: number;
  currency: string;
  notes: string | null;
  votes: number;
  createdAt: string;
  commentCount: number;
}

export interface CommentData {
  id: string;
  dealId: string;
  userId: string;
  content: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeDeal(row: {
  id: string;
  boardId: string;
  userId: string;
  origin: string;
  destination: string;
  price: number;
  currency: string;
  notes: string | null;
  votes: number;
  createdAt: Date;
  _count?: { comments: number };
}): DealData {
  return {
    id: row.id,
    boardId: row.boardId,
    userId: row.userId,
    origin: row.origin,
    destination: row.destination,
    price: row.price,
    currency: row.currency,
    notes: row.notes,
    votes: row.votes,
    createdAt: row.createdAt.toISOString(),
    commentCount: row._count?.comments ?? 0,
  };
}

function serializeBoard(row: {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  creatorId: string;
  createdAt: Date;
  deals: Array<{
    id: string;
    boardId: string;
    userId: string;
    origin: string;
    destination: string;
    price: number;
    currency: string;
    notes: string | null;
    votes: number;
    createdAt: Date;
    _count?: { comments: number };
  }>;
  _count?: { deals: number };
}): BoardData {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isPublic: row.isPublic,
    creatorId: row.creatorId,
    createdAt: row.createdAt.toISOString(),
    dealCount: row._count?.deals ?? row.deals.length,
    deals: row.deals.map(serializeDeal),
  };
}

// ---------------------------------------------------------------------------
// Board CRUD
// ---------------------------------------------------------------------------

export async function listBoards(userId?: string): Promise<BoardData[]> {
  const where = userId
    ? { OR: [{ isPublic: true }, { creatorId: userId }] }
    : { isPublic: true };

  const rows = await prisma.socialBoard.findMany({
    where,
    include: {
      deals: {
        include: { _count: { select: { comments: true } } },
        orderBy: { votes: "desc" },
      },
      _count: { select: { deals: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(serializeBoard);
}

export async function getBoard(id: string, userId?: string): Promise<BoardData | null> {
  const row = await prisma.socialBoard.findUnique({
    where: { id },
    include: {
      deals: {
        include: { _count: { select: { comments: true } } },
        orderBy: { votes: "desc" },
      },
      _count: { select: { deals: true } },
    },
  });

  if (!row) return null;
  if (!row.isPublic && userId && row.creatorId !== userId) return null;

  return serializeBoard(row);
}

export interface CreateBoardInput {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export async function createBoard(userId: string, input: CreateBoardInput): Promise<BoardData> {
  const row = await prisma.socialBoard.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      isPublic: input.isPublic ?? true,
      creatorId: userId,
    },
    include: {
      deals: {
        include: { _count: { select: { comments: true } } },
        orderBy: { votes: "desc" },
      },
      _count: { select: { deals: true } },
    },
  });
  return serializeBoard(row);
}

export async function updateBoard(
  id: string,
  userId: string,
  updates: { name?: string; description?: string; isPublic?: boolean },
): Promise<BoardData | null> {
  const existing = await prisma.socialBoard.findFirst({ where: { id, creatorId: userId } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (updates.name !== undefined) data.name = updates.name.trim();
  if (updates.description !== undefined) data.description = updates.description.trim();
  if (updates.isPublic !== undefined) data.isPublic = updates.isPublic;

  const row = await prisma.socialBoard.update({
    where: { id },
    data,
    include: {
      deals: {
        include: { _count: { select: { comments: true } } },
        orderBy: { votes: "desc" },
      },
      _count: { select: { deals: true } },
    },
  });
  return serializeBoard(row);
}

export async function deleteBoard(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.socialBoard.findFirst({ where: { id, creatorId: userId } });
  if (!existing) return false;
  await prisma.socialBoard.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------------------
// Deal operations
// ---------------------------------------------------------------------------

export interface CreateDealInput {
  origin: string;
  destination: string;
  price: number;
  currency?: string;
  notes?: string;
}

export async function listDeals(boardId: string): Promise<DealData[]> {
  const rows = await prisma.boardDeal.findMany({
    where: { boardId },
    include: { _count: { select: { comments: true } } },
    orderBy: { votes: "desc" },
  });
  return rows.map(serializeDeal);
}

export async function createDeal(boardId: string, userId: string, input: CreateDealInput): Promise<DealData | null> {
  // Verify board exists
  const board = await prisma.socialBoard.findUnique({ where: { id: boardId } });
  if (!board) return null;

  const row = await prisma.boardDeal.create({
    data: {
      boardId,
      userId,
      origin: input.origin.toUpperCase().trim(),
      destination: input.destination.toUpperCase().trim(),
      price: input.price,
      currency: input.currency ?? "USD",
      notes: input.notes?.trim() ?? null,
      votes: 1, // auto-upvote
    },
    include: { _count: { select: { comments: true } } },
  });
  return serializeDeal(row);
}

export async function voteDeal(
  dealId: string,
  direction: "up" | "down",
  userId?: string
): Promise<{ votes: number; userVote: string | null } | null> {
  const deal = await prisma.boardDeal.findUnique({ where: { id: dealId } });
  if (!deal) return null;

  // If userId provided, enforce per-user vote deduplication
  if (userId) {
    const existing = await prisma.dealVote.findUnique({
      where: { userId_dealId: { userId, dealId } },
    });

    if (existing) {
      if (existing.direction === direction) {
        // Same vote again — remove it (toggle off)
        await prisma.$transaction([
          prisma.dealVote.delete({ where: { id: existing.id } }),
          prisma.boardDeal.update({
            where: { id: dealId },
            data: {
              votes: direction === "up"
                ? Math.max(0, deal.votes - 1)
                : deal.votes + 1,
            },
          }),
        ]);
        const updated = await prisma.boardDeal.findUnique({ where: { id: dealId } });
        return { votes: updated?.votes ?? 0, userVote: null };
      } else {
        // Switching direction — update vote and adjust count by 2
        await prisma.$transaction([
          prisma.dealVote.update({
            where: { id: existing.id },
            data: { direction },
          }),
          prisma.boardDeal.update({
            where: { id: dealId },
            data: {
              votes: direction === "up" ? deal.votes + 2 : Math.max(0, deal.votes - 2),
            },
          }),
        ]);
        const updated = await prisma.boardDeal.findUnique({ where: { id: dealId } });
        return { votes: updated?.votes ?? 0, userVote: direction };
      }
    }

    // New vote
    await prisma.$transaction([
      prisma.dealVote.create({ data: { userId, dealId, direction } }),
      prisma.boardDeal.update({
        where: { id: dealId },
        data: {
          votes: direction === "up" ? deal.votes + 1 : Math.max(0, deal.votes - 1),
        },
      }),
    ]);
    const updated = await prisma.boardDeal.findUnique({ where: { id: dealId } });
    return { votes: updated?.votes ?? 0, userVote: direction };
  }

  // Fallback: no userId (anonymous), just increment/decrement
  const newVotes = direction === "up" ? deal.votes + 1 : Math.max(0, deal.votes - 1);
  await prisma.boardDeal.update({ where: { id: dealId }, data: { votes: newVotes } });
  return { votes: newVotes, userVote: null };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function listComments(dealId: string): Promise<CommentData[]> {
  const rows = await prisma.boardComment.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    dealId: r.dealId,
    userId: r.userId,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createComment(
  dealId: string,
  userId: string,
  content: string,
): Promise<CommentData | null> {
  const deal = await prisma.boardDeal.findUnique({ where: { id: dealId } });
  if (!deal) return null;

  const row = await prisma.boardComment.create({
    data: { dealId, userId, content: content.trim() },
  });
  return {
    id: row.id,
    dealId: row.dealId,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}
