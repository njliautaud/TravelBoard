import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";

export async function GET() {
  const user = await getAuthUser();
  return NextResponse.json({
    user: user ? { id: user.id, username: user.username, imageUrl: user.imageUrl } : null,
    loggedIn: user !== null,
    editor: user !== null,
  });
}
