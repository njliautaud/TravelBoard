import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(req: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 413 });
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: `Unsupported file type ${ext || "(none)"}` }, { status: 400 });
  }
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  try {
    const { url } = await saveUpload({
      bytes: Buffer.from(await file.arrayBuffer()),
      filename: name,
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    console.error("upload failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
