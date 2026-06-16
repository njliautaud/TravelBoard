import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";


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
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/uploads/${name}` }, { status: 201 });
}
