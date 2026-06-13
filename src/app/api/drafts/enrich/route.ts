import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { enrichLink } from "@/lib/linkEnrichment";

export const dynamic = "force-dynamic";

/** GET /api/drafts/enrich?url=...&rawText=... — smart-fill from reel/post metadata */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ error: "url query param required" }, { status: 400 });

  try {
    const rawText = searchParams.get("rawText");
    const enrichment = await enrichLink(url, rawText);
    return NextResponse.json({ enrichment });
  } catch (e) {
    return NextResponse.json({ error: `Enrichment failed: ${String(e)}` }, { status: 502 });
  }
}
