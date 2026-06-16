import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function escCsv(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * GET /api/export/csv — download user data as CSV (locations + trips).
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [locations, trips, journalEntries, watches] = await Promise.all([
    prisma.location.findMany({ where: { userId: session.id } }),
    prisma.trip.findMany({ where: { userId: session.id } }),
    prisma.journalEntry.findMany({ where: { userId: session.id } }),
    prisma.watch.findMany({ where: { userId: session.id } }),
  ]);

  const lines: string[] = [];

  // Locations
  lines.push("--- Locations ---");
  lines.push("Name,Country,City,Status,Starred,Latitude,Longitude,Created");
  for (const loc of locations) {
    lines.push(
      [
        escCsv(loc.activityName),
        escCsv(loc.countryName),
        escCsv(loc.city),
        escCsv(loc.status),
        escCsv(loc.starred),
        loc.latitude,
        loc.longitude,
        escCsv(loc.createdAt.toISOString()),
      ].join(","),
    );
  }

  lines.push("");
  lines.push("--- Trips ---");
  lines.push("Code,City,Country,Start,End,Rating,Note");
  for (const trip of trips) {
    lines.push(
      [
        escCsv(trip.code),
        escCsv(trip.city),
        escCsv(trip.country),
        escCsv(trip.startDate?.toISOString() ?? ""),
        escCsv(trip.endDate?.toISOString() ?? ""),
        escCsv(trip.rating ?? ""),
        escCsv(trip.note),
      ].join(","),
    );
  }

  lines.push("");
  lines.push("--- Journal Entries ---");
  lines.push("Title,Location,Country,Date,Mood,Content");
  for (const je of journalEntries) {
    lines.push(
      [
        escCsv(je.title),
        escCsv(je.location),
        escCsv(je.country),
        escCsv(je.date?.toISOString() ?? ""),
        escCsv(je.mood),
        escCsv(je.content.slice(0, 200)),
      ].join(","),
    );
  }

  lines.push("");
  lines.push("--- Price Watches ---");
  lines.push("Origin,Destination,Target Price,Active,Created");
  for (const w of watches) {
    lines.push(
      [
        escCsv(w.origin),
        escCsv(w.destinationCode),
        escCsv(w.targetPrice),
        escCsv(w.active),
        escCsv(w.createdAt.toISOString()),
      ].join(","),
    );
  }

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="travelboard-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
