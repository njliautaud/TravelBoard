import { NextRequest, NextResponse } from "next/server";
import {
  PROGRAMS,
  PARTNERS,
  TRANSFER_EDGES,
  CARD_CATALOG,
} from "@travelboard/core";
import type { ProgramId } from "@travelboard/core";

/**
 * GET /api/loyalty/transfers?cards=chase_sapphire_reserve,amex_gold
 *
 * Given a comma-separated list of card IDs the user holds, returns every
 * transfer partner reachable from those cards, grouped by the card's points
 * program, with transfer ratios. No auth required -- the card list is passed
 * as a query param (identity-only, no credentials).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardIds = (searchParams.get("cards") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Determine which programs the held cards unlock
  const programSet = new Set<ProgramId>();
  for (const cardId of cardIds) {
    const card = CARD_CATALOG.find((c) => c.id === cardId);
    if (card?.transferEnabled) programSet.add(card.program);
  }

  // Build transfer map: program -> partners with ratios
  const transfers: Array<{
    programId: string;
    programName: string;
    partnerId: string;
    partnerName: string;
    partnerKind: "airline" | "hotel";
    partnerFamily?: string;
    ratio: number;
  }> = [];

  for (const programId of programSet) {
    const program = PROGRAMS.find((p) => p.id === programId);
    if (!program) continue;
    for (const edge of TRANSFER_EDGES) {
      if (edge.program !== programId) continue;
      const partner = PARTNERS.find((p) => p.id === edge.partner);
      if (!partner) continue;
      transfers.push({
        programId,
        programName: program.name,
        partnerId: partner.id,
        partnerName: partner.name,
        partnerKind: partner.kind,
        partnerFamily: partner.family,
        ratio: edge.ratio,
      });
    }
  }

  return NextResponse.json({
    programs: [...programSet].map((id) => {
      const p = PROGRAMS.find((pp) => pp.id === id);
      return { id, name: p?.name ?? id };
    }),
    transfers,
  });
}
