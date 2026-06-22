import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { resolveCoverImage, type CoverSearchFields } from "@/lib/coverImage";
import { declutterPlayButton, hasPlayButtonOverlay } from "@/lib/declutterImage";

export const dynamic = "force-dynamic";

const COVER_W = 320;
const COVER_H = 180;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchImageBytes(url: string): Promise<Buffer> {
  const upstream = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!upstream.ok) {
    throw new Error(`upstream ${upstream.status}`);
  }
  let buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.length === 0) {
    throw new Error("upstream empty");
  }
  if (hasPlayButtonOverlay(url)) {
    try {
      buf = await declutterPlayButton(buf);
    } catch {
      /* keep original */
    }
  }
  return buf;
}

async function encodeCover(input: Buffer, format: string): Promise<{ body: Buffer; contentType: string }> {
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(COVER_W, COVER_H, { fit: "cover", position: "centre" })
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== COVER_W || info.height !== COVER_H || info.channels !== 3) {
    throw new Error(`bad image ${info.width}x${info.height} ch=${info.channels}`);
  }

  const want = COVER_W * COVER_H * 3;
  let body: Buffer;
  if (data.length === want) {
    body = data;
  } else {
    body = Buffer.allocUnsafe(want);
    const stride = Math.floor(data.length / COVER_H);
    for (let y = 0; y < COVER_H; y++) {
      data.copy(body, y * COVER_W * 3, y * stride, y * stride + COVER_W * 3);
    }
  }

  if (format === "rgb565") {
    const pixels = new Uint16Array(COVER_W * COVER_H);
    for (let i = 0, p = 0; i < body.length; i += 3, p++) {
      const r = body[i];
      const g = body[i + 1];
      const b = body[i + 2];
      pixels[p] = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    }
    const body = Buffer.allocUnsafe(pixels.length * 2);
    for (let p = 0; p < pixels.length; p++) {
      body.writeUInt16LE(pixels[p], p * 2);
    }
    return { body, contentType: "application/octet-stream" };
  }

  return { body, contentType: "application/octet-stream" };
}

/** GET /api/hardware-cover?id=... — 320×180 cover for ESP32 (default rgb888 raw) */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "rgb888").toLowerCase();

  const loc = await prisma.location.findUnique({
    where: { id },
    select: {
      coverImageUrl: true,
      activityName: true,
      city: true,
      region: true,
      countryName: true,
    },
  });
  if (!loc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const fields: CoverSearchFields = {
    activityName: loc.activityName,
    city: loc.city,
    region: loc.region,
    countryName: loc.countryName,
  };

  const candidates = [loc.coverImageUrl?.trim(), await resolveCoverImage(fields)].filter(
    (url): url is string => Boolean(url?.trim())
  );

  const tried = new Set<string>();
  let lastError = "no cover";

  for (const coverUrl of candidates) {
    if (tried.has(coverUrl)) continue;
    tried.add(coverUrl);

    try {
      const input = await fetchImageBytes(coverUrl);
      const { body, contentType } = await encodeCover(input, format);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "X-Image-Width": String(COVER_W),
          "X-Image-Height": String(COVER_H),
          "X-Image-Format": format,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (e) {
      lastError = String(e);
      console.warn(`[hardware-cover] ${id} failed for ${coverUrl}: ${lastError}`);
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}
