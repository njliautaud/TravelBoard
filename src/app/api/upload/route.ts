import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * POST /api/upload
 *
 * Auth: required.
 * Uploads an image file (multipart form data). Max 15 MB, image types only.
 *
 * Body: multipart/form-data with "file" field
 * Response: { url: string } (relative path to uploaded file)
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await getAuthUser())) {
      return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    }
    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'file' field", status: 400 }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 15 MB)", status: 413 }, { status: 413 });
    }
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: `Unsupported file type ${ext || "(none)"}`, status: 400 }, { status: 400 });
    }
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, name), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url: `/uploads/${name}` }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
