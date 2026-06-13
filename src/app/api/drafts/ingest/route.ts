import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractFirstUrl } from "@/lib/extractUrl";
import { serializeDraft } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * POST /api/drafts/ingest
 * WhatsApp bot (or curl) sends shared links here.
 * Headers: X-Ingest-Key = WHATSAPP_INGEST_KEY
 * Body: { "text": "Check this reel https://instagram.com/...", "username"?: "swann" }
 */
export async function POST(req: NextRequest) {
  const key = process.env.WHATSAPP_INGEST_KEY;
  if (!key || req.headers.get("x-ingest-key") !== key) {
    return NextResponse.json({ error: "Invalid or missing X-Ingest-Key" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "text field required" }, { status: 400 });
  }

  const ownerUsername = (
    typeof body?.username === "string" ? body.username : process.env.WHATSAPP_OWNER_USERNAME ?? "swann"
  )
    .trim()
    .toLowerCase();

  const user = await prisma.user.findUnique({ where: { username: ownerUsername } });
  if (!user) {
    return NextResponse.json({ error: `No user "${ownerUsername}"` }, { status: 404 });
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
}
