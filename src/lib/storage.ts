// Media upload storage, switchable by env so dev stays on the local filesystem
// and production routes to a Supabase Storage bucket — without changing callers.
//
//   STORAGE_DRIVER=local     (default) -> writes to public/uploads/, returns "/uploads/<name>"
//   STORAGE_DRIVER=supabase            -> uploads to a bucket,        returns the public https URL
//
// Both return a plain string stored on Media.url / Location.coverImageUrl and
// rendered with a bare <img src>, so either form works unchanged in the UI.
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export type SavedUpload = { url: string };

function driver(): "local" | "supabase" {
  return process.env.STORAGE_DRIVER === "supabase" ? "supabase" : "local";
}

/** True when the Supabase driver is selected — handy for startup validation. */
export function isSupabaseStorage(): boolean {
  return driver() === "supabase";
}

export async function saveUpload(opts: {
  bytes: Buffer;
  filename: string;
  contentType: string;
}): Promise<SavedUpload> {
  return driver() === "supabase" ? saveToSupabase(opts) : saveToLocal(opts);
}

async function saveToLocal({ bytes, filename }: { bytes: Buffer; filename: string }): Promise<SavedUpload> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, filename), bytes);
  return { url: `/uploads/${filename}` };
}

async function saveToSupabase({
  bytes,
  filename,
  contentType,
}: {
  bytes: Buffer;
  filename: string;
  contentType: string;
}): Promise<SavedUpload> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
  if (!url || !serviceKey) {
    throw new Error(
      "STORAGE_DRIVER=supabase but SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are missing.",
    );
  }
  // Lazy import so dev (local driver) never needs the package loaded, and the
  // service-role client is only ever constructed server-side.
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { error } = await supabase.storage.from(bucket).upload(filename, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return { url: data.publicUrl };
}
