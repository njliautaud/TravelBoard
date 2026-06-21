import { NextRequest, NextResponse } from "next/server";
import { listCoverCandidates, coverSearchQueries, searchCoverImage, type CoverSearchFields } from "@/lib/coverImage";

export const dynamic = "force-dynamic";

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
 * Returns multiple Wikipedia / Wikimedia candidates for cycling in the form.
 *
 * Legacy: GET /api/cover-image?q=... still returns a single url.
 */
export async function GET(req: NextRequest) {
  const fields = parseFields(req);
  if (!fields) {
    return NextResponse.json({ error: "activityName or location fields required" }, { status: 400 });
  }

  // Simple single-query lookup (legacy clients)
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
}
