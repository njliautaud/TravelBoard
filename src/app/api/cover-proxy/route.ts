import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isBlockedProxyHost } from "@/lib/coverProxy";

export const dynamic = "force-dynamic";

// Wikimedia's image CDN (upload.wikimedia.org) returns 403 to non-browser
// User-Agents, so proxy fetches must look like a browser — the same UA these
// images would have loaded with client-side.
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
};

/**
 * GET /api/cover-proxy?url=...&w=480
 * Proxies cover images (Wikimedia, picsum, Google thumbnails) for reliable <img> loading.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || isBlockedProxyHost(parsed.hostname)) {
    return NextResponse.json({ error: "unsupported host" }, { status: 400 });
  }

  const width = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("w") ?? "480", 10) || 480, 64), 1200);

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: FETCH_HEADERS,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    }

    const input = Buffer.from(await upstream.arrayBuffer());
    const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();

    // Confirm it's really an image — some hosts (e.g. fbsbx/lookaside) return
    // an HTML page. Reject those so the browser shows nothing instead of a
    // broken raster, and so we never serve HTML as an image.
    let meta: sharp.Metadata | null = null;
    try {
      meta = await sharp(input).metadata();
    } catch {
      /* not decodable by sharp (could still be a valid SVG) */
    }
    const isImage = Boolean(meta?.format) || contentType.startsWith("image/");
    if (!isImage) {
      return NextResponse.json({ error: "not an image" }, { status: 502 });
    }

    const cacheControl = "public, max-age=604800, stale-while-revalidate=86400";

    if (meta?.width && meta.width > width) {
      const output = await sharp(input)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      return new NextResponse(new Uint8Array(output), {
        status: 200,
        headers: { "Content-Type": "image/jpeg", "Cache-Control": cacheControl },
      });
    }

    return new NextResponse(new Uint8Array(input), {
      status: 200,
      headers: { "Content-Type": contentType || "image/jpeg", "Cache-Control": cacheControl },
    });
  } catch (e) {
    return NextResponse.json({ error: `proxy failed: ${String(e)}` }, { status: 502 });
  }
}
