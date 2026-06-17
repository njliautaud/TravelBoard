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
 * Returns the full catalog of loyalty programs, transfer partners, transfer
 * edges, and card definitions from @travelboard/core. No auth required --
 * this is static reference data.
 */
export async function GET() {
  return NextResponse.json({
    programs: PROGRAMS,
    partners: PARTNERS,
    edges: TRANSFER_EDGES,
    cards: CARD_CATALOG,
  });
}
