import { NextResponse } from "next/server";
import {
  PROGRAMS,
  PARTNERS,
  TRANSFER_EDGES,
  CARD_CATALOG,
} from "@travelboard/core";

/**
 * GET /api/loyalty/programs
 *
 * Auth: none (public reference data).
 * Returns the full catalog of loyalty programs, transfer partners, transfer
 * edges, and card definitions.
 *
 * Response: { programs, partners, edges, cards }
 */
export async function GET() {
  try {
    return NextResponse.json({
      programs: PROGRAMS,
      partners: PARTNERS,
      edges: TRANSFER_EDGES,
      cards: CARD_CATALOG,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
