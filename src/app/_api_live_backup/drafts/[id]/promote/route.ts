import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { enrichLink } from "@/lib/linkEnrichment";


type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/drafts/:id/promote
 * Convert a WhatsApp/Instagram draft into a journal entry.
 * Enriches the link, extracts location/caption, and creates a journal entry.
 * Optionally accepts overrides in the body: { title, content, mood, weather, tags, isPublic }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const draft = await prisma.draft.findFirst({ where: { id, userId: user.id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Enrich the link for metadata
  let enrichment = null;
  if (draft.extractedUrl) {
    try {
      enrichment = await enrichLink(draft.extractedUrl, draft.rawText);
    } catch {
      // proceed without enrichment
    }
  }

  // Build journal entry from enrichment + overrides
  const title = body.title
    || enrichment?.activityName
    || enrichment?.title
    || draft.rawText?.slice(0, 80)
    || "Untitled entry";

  const contentParts: string[] = [];
  if (enrichment?.notes) contentParts.push(enrichment.notes);
  if (draft.rawText && !contentParts.some(p => p.includes(draft.rawText!))) {
    contentParts.push(draft.rawText);
  }
  if (draft.extractedUrl) contentParts.push(`Source: ${draft.extractedUrl}`);

  const content = body.content || contentParts.join("\n\n");

  const entry = await prisma.journalEntry.create({
    data: {
      userId: user.id,
      title: title.trim(),
      content,
      location: body.location || enrichment?.geocode?.city || enrichment?.locationQuery || null,
      country: body.country || enrichment?.geocode?.countryName || null,
      lat: enrichment?.geocode?.latitude ?? null,
      lon: enrichment?.geocode?.longitude ?? null,
      date: new Date(),
      mood: body.mood || null,
      weather: body.weather || null,
      tags: JSON.stringify(body.tags || [draft.source, enrichment?.platform].filter(Boolean)),
      photos: JSON.stringify(enrichment?.thumbnailUrl ? [enrichment.thumbnailUrl] : []),
      isPublic: body.isPublic ?? false,
    },
    include: { trip: { select: { id: true, city: true, country: true } } },
  });

  // Optionally delete the draft after promotion
  if (body.deleteDraft !== false) {
    await prisma.draft.delete({ where: { id } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, entry }, { status: 201 });
}
