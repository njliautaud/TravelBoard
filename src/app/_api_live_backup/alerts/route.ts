import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listAlerts,
  getUnacknowledgedAlertCount,
} from "@/lib/services/watches";


/** GET /api/alerts — recent alerts for the current user */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [alerts, unreadCount] = await Promise.all([
    listAlerts(user.id),
    getUnacknowledgedAlertCount(user.id),
  ]);

  return NextResponse.json({ alerts, unreadCount });
}
