import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { extractFirstUrl } from "@/lib/extractUrl";
import { serializeDraft } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * POST /api/drafts/import
 * Authenticated endpoint for users to directly paste links (Instagram, TikTok, YouTube, etc.)
 * into their draft inbox — no WhatsApp bot needed.
 * Body: { "text": "https://instagram.com/reel/...", "source"?: "instagram" | "manual" }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text field required" }, { status: 400 });
  }

  const extractedUrl = extractFirstUrl(text) ?? (typeof body?.url === "string" ? body.url : null);

  // Detect source from URL if not provided
  let source = typeof body?.source === "string" ? body.source : "manual";
  if (extractedUrl) {
    const host = (() => { try { return new URL(extractedUrl).hostname; } catch { return ""; } })();
    if (host.includes("instagram.com")) source = "instagram";
    else if (host.includes("tiktok.com")) source = "tiktok";
    else if (host.includes("youtube.com") || host.includes("youtu.be")) source = "youtube";
  }

  const draft = await prisma.draft.create({
    data: {
      userId: user.id,
      rawText: text,
      extractedUrl,
      source,
    },
  });

  return NextResponse.json({ ok: true, draft: serializeDraft(draft) }, { status: 201 });
}
