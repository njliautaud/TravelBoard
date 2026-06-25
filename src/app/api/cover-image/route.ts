import { NextRequest, NextResponse } from "next/server";
import { listCoverCandidates, coverSearchQueries, searchCoverImage, type CoverSearchFields } from "@/lib/coverImage";


function parseFields(req: NextRequest): CoverSearchFields | null {
  const p = req.nextUrl.searchParams;
  const activityName = p.get("activityName")?.trim() ?? "";
  const city = p.get("city")?.trim() || null;
  const region = p.get("region")?.trim() || null;
  const countryName = p.get("countryName")?.trim() || null;

  if (activityName || city || region || countryName) {
    return { activityName, city, region, countryName };
  }

  const q = p.get("q")?.trim();
  if (q) return { activityName: q, city: null, region: null, countryName: null };

  return null;
}

/**
 * GET /api/cover-image?activityName=...&city=...&region=...&countryName=...
 *
 * Auth: none (public).
 * Returns cover image candidates from Wikipedia/Wikimedia.
 * Legacy: GET /api/cover-image?q=... returns a single url.
 *
 * Response: { candidates: string[], url: string | null, total: number }
 */
export async function GET(req: NextRequest) {
  try {
    const fields = parseFields(req);
    if (!fields) {
      return NextResponse.json({ error: "activityName or location fields required", status: 400 }, { status: 400 });
    }

    const qOnly = req.nextUrl.searchParams.get("q")?.trim();
    if (qOnly && !req.nextUrl.searchParams.get("activityName")) {
      const url = await searchCoverImage(qOnly);
      return NextResponse.json({ url });
    }

    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "3", 10) || 3, 1), 12);
    const candidates = await listCoverCandidates(fields, limit);
    const queries = coverSearchQueries(fields);
    return NextResponse.json({
      candidates,
      url: candidates[0]?.url ?? null,
      total: candidates.length,
      query: queries[0] ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
