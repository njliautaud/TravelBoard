import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ends the Supabase session and clears its auth cookies.
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
