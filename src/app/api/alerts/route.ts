import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import {
  listAlerts,
  getUnacknowledgedAlertCount,
} from "@/lib/services/watches";


/**
 * GET /api/alerts
 *
 * Auth: required.
 * Returns recent alerts and unread count for the current user.
 *
 * Response: { alerts: AlertLog[], unreadCount: number }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    }

    const [alerts, unreadCount] = await Promise.all([
      listAlerts(user.id),
      getUnacknowledgedAlertCount(user.id),
    ]);

    return NextResponse.json({ alerts, unreadCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
