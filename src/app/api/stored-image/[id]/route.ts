import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/stored-image/[id]
 * Serves image bytes captured into the shared DB (e.g. an Instagram reel cover).
 * Same-origin and immutable, so covers load reliably on every machine.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const img = await prisma.storedImage.findUnique({ where: { id } });
  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(img.bytes), {
    status: 200,
    headers: {
      "Content-Type": img.mime || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
