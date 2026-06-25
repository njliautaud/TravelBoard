import { NextRequest, NextResponse } from "next/server";
import { setUsername } from "@/lib/auth";

// Finalizes an OAuth signup's username (the "choose a username" popup).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = body?.username;
  if (typeof username !== "string") {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }
  const result = await setUsername(username);
  if ("error" in result) {
    const status = result.error === "Not signed in" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ user: result.user });
}
