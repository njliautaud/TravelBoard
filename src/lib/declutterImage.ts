import sharp from "sharp";

/**
 * Remove the centered "play" overlay (white triangle in a dark circle) that
 * Instagram / TikTok / YouTube bake into reel & short thumbnails.
 *
 * There's no clean source frame available publicly, so we inpaint the center
 * with a feathered patch sampled from just above/below the button. Works well
 * for the common case where the button sits dead-center over the video frame.
 */
export async function declutterPlayButton(input: Buffer): Promise<Buffer> {
  const base = sharp(input, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return input;

  const flat = await base.toColorspace("srgb").toFormat("png").toBuffer();

  // Button bounding box: centered square, ~42% of the short edge (clamped).
  const short = Math.min(width, height);
  const size = Math.max(90, Math.min(260, Math.round(short * 0.42)));
  const left = Math.round((width - size) / 2);
  const top = Math.round((height - size) / 2);

  // Sample the replacement patch from the SIDE at the same height: horizontal
  // bands (horizon, sky, water) stay continuous, avoiding a visible seam.
  let srcLeft = left - size;
  if (srcLeft < 0) srcLeft = left + size;
  if (srcLeft + size > width) srcLeft = Math.max(0, width - size);

  const patch = await sharp(flat)
    .extract({ left: srcLeft, top, width: size, height: size })
    .toBuffer();

  // Feather mask: opaque in the center, fading to transparent at the edges so
  // the patch blends into the surrounding pixels.
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
          <stop offset="62%" stop-color="#fff" stop-opacity="1"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#g)"/>
    </svg>`
  );

  // Apply the feather as the patch's alpha channel (dest-in keeps patch where mask is opaque).
  const featheredPatch = await sharp(patch)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  return sharp(flat)
    .composite([{ input: featheredPatch, left, top }])
    .jpeg({ quality: 86 })
    .toBuffer();
}

const SOCIAL_CDN_RE =
  /(cdninstagram\.com|fbcdn\.net|tiktokcdn|ytimg\.com|sndcdn\.com|akamaihd\.net)/i;

/** True when a thumbnail URL is from a platform that bakes in a play button. */
export function hasPlayButtonOverlay(url: string): boolean {
  try {
    return SOCIAL_CDN_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}
