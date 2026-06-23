import { NextRequest, NextResponse } from "next/server";
import { declutterPlayButton, hasPlayButtonOverlay } from "@/lib/declutterImage";


const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
};

/**
 * GET /api/image-proxy?url=...
 * Fetches a social-platform thumbnail and strips the baked-in play button.
 * Restricted to known media CDNs to avoid being an open proxy.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !hasPlayButtonOverlay(url)) {
    return NextResponse.json({ error: "unsupported host" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!upstream.ok) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    }
    const input = Buffer.from(await upstream.arrayBuffer());

    let output: Buffer = input;
    try {
      output = await declutterPlayButton(input);
    } catch {
      // If processing fails, fall back to the original image.
      output = input;
    }

    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `proxy failed: ${String(e)}` }, { status: 502 });
  }
}
