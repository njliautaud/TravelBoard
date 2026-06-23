import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractFirstUrl } from "@/lib/extractUrl";
import { serializeDraft } from "@/lib/serialize";
import { validateApiKey } from "@/lib/api-utils";


/**
 * POST /api/drafts/ingest
 *
 * Auth: API key via X-Ingest-Key header (WHATSAPP_INGEST_KEY env var).
 * WhatsApp bot (or curl) sends shared links here.
 *
 * Body: { text: string, username?: string, url?: string, source?: string }
 * Response: { ok: true, draft: DraftItem }
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req, "x-ingest-key", "WHATSAPP_INGEST_KEY")) {
    return NextResponse.json(
      { error: "Invalid or missing X-Ingest-Key", status: 401 },
      { status: 401 },
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "text field required", status: 400 }, { status: 400 });
    }

    const ownerUsername = (
      typeof body?.username === "string" ? body.username : process.env.WHATSAPP_OWNER_USERNAME ?? "swann"
    )
      .trim()
      .toLowerCase();

    const user = await prisma.user.findUnique({ where: { username: ownerUsername } });
    if (!user) {
      return NextResponse.json({ error: `No user "${ownerUsername}"`, status: 404 }, { status: 404 });
    }

    const extractedUrl = extractFirstUrl(text) ?? (typeof body?.url === "string" ? body.url : null);

    const draft = await prisma.draft.create({
      data: {
        userId: user.id,
        rawText: text.trim(),
        extractedUrl,
        source: typeof body?.source === "string" ? body.source : "whatsapp",
      },
    });

    return NextResponse.json({ ok: true, draft: serializeDraft(draft) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
