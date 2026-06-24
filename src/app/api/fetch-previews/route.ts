import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchSerperImages,
  looksExplicit,
  normalizeQuery,
  placeholderImages,
  type PreviewImage,
} from "@/lib/serperImages";
import { overlapScore } from "@/lib/similarity";

export const dynamic = "force-dynamic";

// How alike two queries must be to reuse one's cached images for the other.
const SIMILAR_THRESHOLD = 0.6;
// Cap the similarity scan for a personal-scale cache.
const SIMILAR_SCAN_LIMIT = 300;

/**
 * GET  /api/fetch-previews?query=...&limit=6&refresh=0|1
 * POST /api/fetch-previews   { "query": "...", "limit": 6, "refresh": true }
 *
 * Cache-first Google Images (Serper.dev):
 *   1. Normalize the query.
 *   2. Exact cache hit -> return instantly (match: "exact").
 *   3. No exact hit -> find a cached query for the *same wish* (fuzzy) and reuse
 *      its images (match: "similar"). Pass refresh=1 to skip this and force a
 *      fresh Serper pull (the "Regenerate" button).
 *   4. Otherwise call Serper, cache, and return (match: "fresh").
 *   5. Serper down / rate-limited / unconfigured -> placeholders, not cached.
 */
async function handle(
  rawQuery: string | null,
  rawLimit: string | number | null,
  rawRefresh: string | boolean | null,
) {
  const query = typeof rawQuery === "string" ? rawQuery : "";
  const searchQuery = normalizeQuery(query);
  if (!searchQuery) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const limit = Math.min(Math.max(Number(rawLimit) || 6, 3), 6);
  const refresh = rawRefresh === true || rawRefresh === "1" || rawRefresh === "true";

  // Explicit queries: never serve from cache (it may predate SafeSearch) and
  // never reuse a "similar" wish — always do a fresh SafeSearch pull below.
  const explicit = looksExplicit(searchQuery);

  if (!refresh && !explicit) {
    // 2. Exact cache hit.
    const exact = await prisma.imageCache.findUnique({ where: { searchQuery } });
    if (exact) {
      return NextResponse.json({
        query: searchQuery,
        cached: true,
        match: "exact",
        source: exact.source,
        images: (exact.images as unknown as PreviewImage[]).slice(0, limit),
      });
    }

    // 3. Same-wish (fuzzy) hit — reuse a similar query's images.
    const candidates = await prisma.imageCache.findMany({
      orderBy: { updatedAt: "desc" },
      take: SIMILAR_SCAN_LIMIT,
    });
    let best: (typeof candidates)[number] | null = null;
    let bestScore = 0;
    for (const c of candidates) {
      const score = overlapScore(searchQuery, c.searchQuery);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best && bestScore >= SIMILAR_THRESHOLD) {
      const images = (best.images as unknown as PreviewImage[]).slice(0, limit);
      // Cache under this query too so the next exact lookup is instant.
      await prisma.imageCache.upsert({
        where: { searchQuery },
        create: { searchQuery, images: images as unknown as Prisma.InputJsonValue, source: "serper-similar" },
        update: { images: images as unknown as Prisma.InputJsonValue, source: "serper-similar" },
      });
      return NextResponse.json({
        query: searchQuery,
        cached: true,
        match: "similar",
        similarTo: best.searchQuery,
        score: Number(bestScore.toFixed(2)),
        source: "serper-similar",
        images,
      });
    }
  }

  // 4. Cache miss (or forced refresh) — call Serper, then persist.
  try {
    const images = await fetchSerperImages(searchQuery, limit);
    if (images.length === 0) {
      // SafeSearch returned nothing (e.g. an explicit query). Drop any stale
      // cache row so it can't be served on a later non-refresh lookup.
      if (explicit) {
        await prisma.imageCache.deleteMany({ where: { searchQuery } });
      }
      return NextResponse.json({
        query: searchQuery,
        cached: false,
        match: "placeholder",
        source: "placeholder",
        images: placeholderImages(searchQuery, 3),
      });
    }

    // Preserve any captured Instagram cover(s) for this activity across a
    // refresh — "Regenerate" pulls fresh Google images but the reel cover for
    // the same activity stays among the options (appended, after the new pull).
    const prior = await prisma.imageCache.findUnique({ where: { searchQuery } });
    const igEntries = ((prior?.images as unknown as (PreviewImage & { source?: string })[] | undefined) ?? [])
      .filter((p) => p.source === "instagram" && !images.some((im) => im.imageUrl === p.imageUrl));
    const merged = [...images, ...igEntries];

    const imagesJson = merged as unknown as Prisma.InputJsonValue;
    await prisma.imageCache.upsert({
      where: { searchQuery },
      create: { searchQuery, images: imagesJson, source: "serper" },
      update: { images: imagesJson, source: "serper" },
    });

    return NextResponse.json({
      query: searchQuery,
      cached: false,
      match: "fresh",
      source: "serper",
      images: merged,
    });
  } catch (e) {
    // 5. Serper down / 429 / missing key — graceful placeholder, not cached.
    console.error("fetch-previews: Serper failed —", String(e));
    return NextResponse.json({
      query: searchQuery,
      cached: false,
      match: "placeholder",
      source: "placeholder",
      images: placeholderImages(searchQuery, 3),
    });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handle(searchParams.get("query"), searchParams.get("limit"), searchParams.get("refresh"));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  return handle(body?.query ?? null, body?.limit ?? null, body?.refresh ?? null);
}
