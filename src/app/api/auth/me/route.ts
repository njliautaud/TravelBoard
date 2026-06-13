import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({
    user,
    loggedIn: user !== null,
    editor: user !== null,
  });
}
